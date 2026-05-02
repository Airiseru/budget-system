import { db } from '../database'
import { 
    Entity, NewEntity,
    User, UserRole,  UserUpdate, UserEntity,
    Department, NewDepartment, DepartmentUpdate,
    Agency, NewAgency, AgencyUpdate,
    OperatingUnit, NewOperatingUnit, OperatingUnitUpdate,
    EntityRequest, NewEntityRequest, EntityRequestUpdate
} from '../../../types/entities'
import { sql } from 'kysely'

// ENTITIES
export async function getAllEntities(): Promise<Entity[]> {
    return await db.selectFrom('entities').selectAll().execute()
}

export async function getAllEntitiesExceptType(type: string): Promise<Entity[]> {
    return await db.selectFrom('entities').selectAll().where('type', '!=', type).execute()
}

export async function getEntityById(id: string): Promise<Entity | null> {
    return await db.selectFrom('entities').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

export async function createEntity(entity: NewEntity): Promise<Entity> {
    return await db.insertInto('entities').values(entity).returningAll().executeTakeFirstOrThrow()
}

export async function deleteEntity(id: string): Promise<void> {
    await db.deleteFrom('entities').where('id', '=', id).returningAll().executeTakeFirst()
}

// DEPARTMENTS
export async function getAllDepartments(): Promise<Department[]> {
    return await db.selectFrom('departments').selectAll().execute()
}

export async function getDepartmentById(id: string): Promise<Department | null> {
    return await db.selectFrom('departments').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

export async function createDepartment(department: Partial<Department>): Promise<Department> {
    // Create transaction block
    return await db.transaction().execute(async (trx) => {
        
        // Create entity
        const new_entity = await trx.insertInto('entities')
            .values({ type: 'department' })
            .returningAll()
            .executeTakeFirstOrThrow()
            
        // Get generated id
        department.id = new_entity.id

        // Create department
        return await trx.insertInto('departments')
            .values(department as NewDepartment)
            .returningAll()
            .executeTakeFirstOrThrow()
    })
}

export async function updateDepartment(id: string, updateWith: DepartmentUpdate): Promise<void> {
    await db
        .updateTable('departments')
        .set(updateWith)
        .where('id', '=', id)
        .execute()
}

export async function deleteDepartment(id: string): Promise<void> {
    await db.deleteFrom('departments').where('id', '=', id).returningAll().executeTakeFirst()
}

// AGENCIES
export async function getAllAgencies(): Promise<Agency[]> {
    return await db.selectFrom('agencies').selectAll().execute()
}

export async function getAgencyById(id: string): Promise<Agency | null> {
    return await db.selectFrom('agencies').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

export async function getAllAgenciesByDepartmentId(department_id: string): Promise<Agency[]> {
    return await db.selectFrom('agencies').selectAll().where('department_id', '=', department_id).execute()
}

export async function createAgency(agency: Partial<NewAgency>, department_id: string | null): Promise<Partial<Agency>> {
    return await db.transaction().execute(async (trx) => {
        // Create entity
        const new_entity = await trx.insertInto('entities')
            .values({ type: 'agency' })
            .returning('id')
            .executeTakeFirstOrThrow()

        // Create independent agency
        if (department_id === null) {
            return await trx.insertInto('agencies')
                .values({ ...(agency as NewAgency), id: new_entity.id })
                .returningAll()
                .executeTakeFirstOrThrow()
        }

        // Create agency
        return await trx.insertInto('agencies')
            .values({ ...(agency as NewAgency), id: new_entity.id, department_id })
            .returning(['id', 'name', 'abbr', 'uacs_code', 'type'])
            .executeTakeFirstOrThrow()
    })
}
export async function updateAgency(id: string, updateWith: AgencyUpdate): Promise<void> {
    await db
        .updateTable('agencies')
        .set(updateWith)
        .where('id', '=', id)
        .execute()
}

export async function deleteAgency(id: string): Promise<void> {
    await db.deleteFrom('agencies').where('id', '=', id).returningAll().executeTakeFirst()
}

// OPERATING UNITS
export async function getAllOperatingUnits(): Promise<OperatingUnit[]> {
    return await db.selectFrom('operating_units').selectAll().execute()
}

export async function getOperatingUnitById(id: string): Promise<OperatingUnit | null> {
    return await db.selectFrom('operating_units').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

function normalizeSegment(code: string | null | undefined, length: number) {
    if (!code) return ''.padEnd(length, '0')
    return code.slice(0, length).padEnd(length, '0')
}

async function getOperatingUnitUacsSegments(operatingUnitId: string) {
    let current = await getOperatingUnitById(operatingUnitId)
    if (!current) {
        return { topLevelCode: '00', lowerLevelCode: '00000' }
    }

    if (!current.parent_ou_id) {
        return {
            topLevelCode: normalizeSegment(current.uacs_code, 2),
            lowerLevelCode: '00000',
        }
    }

    const lowerLevelCode = normalizeSegment(current.uacs_code, 5)

    while (current?.parent_ou_id) {
        current = await getOperatingUnitById(current.parent_ou_id)
        if (!current) break
        if (!current.parent_ou_id) {
            return {
                topLevelCode: normalizeSegment(current.uacs_code, 2),
                lowerLevelCode,
            }
        }
    }

    return { topLevelCode: '00', lowerLevelCode }
}

export async function getFullUacsCodeByEntityId(entityId: string): Promise<Record<string, string> | null> {
    const entity = await getEntityById(entityId).catch(() => null)
    if (!entity) return null

    if (entity.type === 'department') {
        const department = await getDepartmentById(entityId).catch(() => null)
        if (!department) return null
        const entityName = department.name
        return {
            fullCode: `${normalizeSegment(department.uacs_code, 2)}0000000000`,
            entityName
        }
    }

    if (entity.type === 'agency') {
        const agency = await getAgencyById(entityId).catch(() => null)
        if (!agency) return null
        const department = await getDepartmentById(agency.department_id ?? '').catch(() => null)
        const departmentCode = agency.department_id
            ? normalizeSegment(department?.uacs_code, 2)
            : '00'

        const entityName = `${agency.name} under the ${department?.name}`

        return {
            fullCode: `${departmentCode}${normalizeSegment(agency.uacs_code, 3)}0000000`,
            entityName
        }
    }

    if (entity.type === 'operating_unit') {
        const operatingUnit = await getOperatingUnitById(entityId).catch(() => null)
        if (!operatingUnit) return null

        const agency = await getAgencyById(operatingUnit.agency_id).catch(() => null)
        const department = await getDepartmentById(agency?.department_id ?? '').catch(() => null)
        const departmentCode = agency?.department_id
            ? normalizeSegment(department?.uacs_code, 2)
            : '00'
        const agencyCode = normalizeSegment(agency?.uacs_code, 3)
        const { topLevelCode, lowerLevelCode } = await getOperatingUnitUacsSegments(entityId)

        const entityName = `${operatingUnit.name} under the ${department?.name}'s ${agency?.name}`

        return {
            fullCode: `${departmentCode}${agencyCode}${topLevelCode}${lowerLevelCode}`,
            entityName
        }
    }

    return null
}

export async function getFullEntityNameById(entityId: string): Promise<string | null> {
    const entity = await getEntityById(entityId).catch(() => null)
    if (!entity) return null
    let text = ""

    if (entity.type === 'operating_unit') {
        const operatingUnit = await getOperatingUnitById(entityId).catch(() => null)
        if (!operatingUnit) return null

        let parentOperatingUnit = null

        if (operatingUnit.parent_ou_id) {
            parentOperatingUnit = await getOperatingUnitById(operatingUnit.parent_ou_id).catch(() => null)
            if (!parentOperatingUnit) return null
        }

        const agency = await getAgencyById(operatingUnit.agency_id).catch(() => null)
        if (!agency) return null

        const department = await getDepartmentById(agency.department_id ?? '').catch(() => null)
        if (!department) return null

        text = `${operatingUnit.name}`

        if (parentOperatingUnit) {
            text = `${parentOperatingUnit.name} - ${text}`
        }
        
        text += `under the ${department.name}'s ${agency.name}`
    }

    else if (entity.type === 'agency') {
        const agency = await getAgencyById(entityId).catch(() => null)
        if (!agency) return null

        const department = await getDepartmentById(agency.department_id ?? '').catch(() => null)
        if (!department) return null

        text = `${agency.name} under the ${department.name}`
    }

    else if (entity.type === 'department') {
        const department = await getDepartmentById(entityId).catch(() => null)
        if (!department) return null

        text = `${department.name}`
    }

    return text
}

type OperatingUnitSummary = Pick<OperatingUnit, 'id' | 'name' | 'abbr' | 'uacs_code' | 'agency_id' | 'parent_ou_id' | 'status'>

export async function getAllOperatingUnitsByAgencyId(agency_id: string): Promise<OperatingUnitSummary[]> {
    return await db
        .selectFrom('operating_units')
        .select([
            'operating_units.id as id',
            'operating_units.name as name',
            'operating_units.abbr as abbr',
            'operating_units.uacs_code as uacs_code',
            'operating_units.agency_id as agency_id',
            'operating_units.parent_ou_id as parent_ou_id',
            'operating_units.status as status',
        ])
        .where('agency_id', '=', agency_id)
        .execute()
}

export async function createOperatingUnit(operating_unit: Partial<NewOperatingUnit>, agency_id: string): Promise<Partial<OperatingUnit>> {
    return await db.transaction().execute(async (trx) => {
        // Create entity
        const new_entity = await trx.insertInto('entities')
            .values({ type: 'operating_unit' })
            .returning('id')
            .executeTakeFirstOrThrow()

        // Create operating unit
        return await trx.insertInto('operating_units')
            .values({ ...(operating_unit as NewOperatingUnit), id: new_entity.id, agency_id })
            .returning(['id', 'name', 'abbr', 'uacs_code', 'agency_id', 'parent_ou_id', 'status'])
            .executeTakeFirstOrThrow()
    })
}

export async function updateOperatingUnit(id: string, updateWith: OperatingUnitUpdate): Promise<void> {
    await db
        .updateTable('operating_units')
        .set(updateWith)
        .where('id', '=', id)
        .execute()
}

export async function deleteOperatingUnit(id: string): Promise<void> {
    await db.deleteFrom('operating_units').where('id', '=', id).returningAll().executeTakeFirst()
}

export async function getAllEntitySegments(isCreate: boolean = false) {
    let departmentsQuery = await db
        .selectFrom('departments')
        .innerJoin('entities', 'entities.id', 'departments.id')
        .select([
            'entities.id as id',
            'entities.type as entity_type',
            'departments.name as name',
            'departments.abbr as abbr',
            'departments.uacs_code as uacs_code',
            'departments.status as status',
        ])
        .orderBy('departments.uacs_code', 'asc')

    if (isCreate) {
        departmentsQuery = departmentsQuery.where('departments.status', '=', 'active')
    }

    const departments = await departmentsQuery.execute()

    let agenciesQuery = await db
        .selectFrom('agencies')
        .innerJoin('entities', 'entities.id', 'agencies.id')
        .select([
            'entities.id as id',
            'entities.type as entity_type',
            'agencies.name as name',
            'agencies.abbr as abbr',
            'agencies.uacs_code as uacs_code',
            'agencies.type as type',
            'agencies.department_id as department_id',
            'agencies.status as status',
        ])
        .orderBy('agencies.uacs_code', 'asc')

    if (isCreate) {
        agenciesQuery = agenciesQuery.where('agencies.status', '=', 'active')
    }

    const agencies = await agenciesQuery.execute()

    let operatingUnitsQuery = await db
        .selectFrom('operating_units')
        .innerJoin('entities', 'entities.id', 'operating_units.id')
        .select([
            'entities.id as id',
            'entities.type as entity_type',
            'operating_units.name as name',
            'operating_units.abbr as abbr',
            'operating_units.uacs_code as uacs_code',
            'operating_units.agency_id as agency_id',
            'operating_units.parent_ou_id as parent_ou_id',
            'operating_units.status as status',
        ])
        .orderBy('operating_units.uacs_code', 'asc')

    if (isCreate) {
        operatingUnitsQuery = operatingUnitsQuery.where('operating_units.status', '=', 'active')
    }

    const operatingUnits = await operatingUnitsQuery.execute()

    return { departments, agencies, operatingUnits }
}

export async function getEntitySegmentsByDepartment(departmentId: string) {
    const agencies = await db
        .selectFrom('agencies')
        .innerJoin('entities', 'entities.id', 'agencies.id')
        .select([
            'entities.id as id',
            'entities.type as entity_type',
            'agencies.name as name',
            'agencies.department_id as department_id',
            'agencies.uacs_code as uacs_code',
            'agencies.abbr as abbr',
            'agencies.type as type',
            'agencies.status as status',
        ])
        .where('department_id', '=', departmentId)
        .execute()

    const agencyIds = agencies.map(a => a.id)

    const operatingUnits = agencyIds.length > 0
        ? await db
            .selectFrom('operating_units')
            .innerJoin('entities', 'entities.id', 'operating_units.id')
            .select([
                'entities.id as id',
                'entities.type as entity_type',
                'operating_units.name as name',
                'operating_units.agency_id',
                'operating_units.abbr as abbr',
                'operating_units.uacs_code as uacs_code',
                'operating_units.parent_ou_id as parent_ou_id',
                'operating_units.status as status',
            ])
            .where('operating_units.agency_id', 'in', agencyIds)
            .execute()
        : []

    return { agencies, operatingUnits }
}

export async function getFullEntityById(
    type: string,
    id: string
) {
    try {
        if (type === 'department') {
            return await db.selectFrom('departments')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst()
        } 
        else if (type === 'agency') {
            return await db.selectFrom('agencies')
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst()
        } 
        else if (type === 'operating_unit') {
            return await db.selectFrom('operating_units')
                .leftJoin('agencies', 'agencies.id', 'operating_units.agency_id')
                .where('operating_units.id', '=', id)
                .select([
                    'operating_units.id as id',
                    'operating_units.name as name',
                    'operating_units.uacs_code as uacs_code',
                    'operating_units.abbr as abbr',
                    'operating_units.agency_id as agency_id',
                    'operating_units.parent_ou_id as parent_ou_id',
                    'operating_units.status as status',
                    'agencies.department_id as department_id',
                ])
                .executeTakeFirst()
        }
        
        return null
    } catch (error) {
        console.error("Failed to fetch full entity:", error)
        return null
    }
}
    
// USERS
export async function getAllUsers(active_only: boolean = true): Promise<Partial<User>[]> {
    const query = db
        .selectFrom('users')
        .select([
            'users.id as id',
            'users.entity_id as entity_id',
            'users.name as name',
            'users.email as email',
            'users.position as position',
            'users.role as role',
            'users.access_level as access_level',
        ])

    if (active_only) {
        query.where('users.deleted_at', 'is', null)
    }
    
    return await query.execute()
}

export async function getUserById(id: string): Promise<User> {
    return await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
}

export async function getUserPin(id: string): Promise<Partial<User>> {
    return await db
        .selectFrom('users')
        .select([
            'id',
            'signing_pin_hash'
        ])
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
}

export async function getUserByRole(role: UserRole): Promise<User[]> {
    return await db
        .selectFrom('users')
        .selectAll()
        .where('role', '=', role)
        .execute()
}

export async function getPendingUsers(): Promise<UserEntity[]> {
    return await db
        .selectFrom('users')
        .leftJoin('entities', 'users.entity_id', 'entities.id')
        .leftJoin('departments', 'departments.id', 'entities.id')
        .leftJoin('agencies', 'agencies.id', 'entities.id')
        .select([
            'users.id as user_id',
            'users.name as user_name',
            'users.email as user_email',
            'users.position as position',
            'users.role as role',
            'users.workflow_role as workflow_role',
            'users.access_level as access_level',
            'users.created_at as user_created_at',
            'users.updated_at as user_updated_at',
        ])
        .select([
            sql<string>`COALESCE(entities.type, '')`.as('entity_type'),
            sql<string>`COALESCE(departments.name, agencies.name, '')`.as('entity_name')
        ])
        .where('role', '=', 'unverified')
        .orderBy('users.created_at', 'asc')
        .execute()
}

export async function getEntityOfUser(entityId: string) {
    return await db
        .selectFrom('entities')
        .leftJoin('departments', 'departments.id', 'entities.id')
        .leftJoin('agencies', 'agencies.id', 'entities.id')
        .leftJoin('operating_units', 'operating_units.id', 'entities.id')
        .select([
            'entities.id as entity_id',
            'entities.type as entity_type',
            // department fields
            'departments.id as department_id',
            'departments.name as department_name',
            'departments.abbr as department_abbr',
            'departments.uacs_code as department_uacs_code',
            // agency fields
            'agencies.id as agency_id',
            'agencies.name as agency_name',
            'agencies.abbr as agency_abbr',
            'agencies.department_id as parent_department_id',
            // operating unit fields
            'operating_units.id as operating_unit_id',
            'operating_units.name as operating_unit_name',
            'operating_units.abbr as operating_unit_abbr',
            'operating_units.agency_id as parent_agency_id',
        ])
        .where('entities.id', '=', entityId)
        .executeTakeFirst()
}

export async function updateUser(id: string, updateWith: UserUpdate): Promise<void> {
    await db
        .updateTable('users')
        .set(updateWith)
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
}

export async function deleteUser(id: string): Promise<void> {
    await db.updateTable('users').set({ deleted_at: new Date(), role: 'archived' }).where('id', '=', id).executeTakeFirstOrThrow()
}

export async function createEntityRequest(request: NewEntityRequest): Promise<EntityRequest> {
    return await db
        .insertInto('entity_requests')
        .values(request)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function getEntityRequestById(id: string) {
    return await db
        .selectFrom('entity_requests')
        .leftJoin('departments as request_departments', 'request_departments.id', 'entity_requests.requested_by_id')
        .leftJoin('agencies as request_agencies', 'request_agencies.id', 'entity_requests.requested_by_id')
        .leftJoin('operating_units as request_ous', 'request_ous.id', 'entity_requests.requested_by_id')
        .leftJoin('users', 'users.id', 'entity_requests.requested_by_user_id')
        .leftJoin('departments as parent_departments', 'parent_departments.id', 'entity_requests.proposed_parent_department_id')
        .leftJoin('agencies as parent_agencies', 'parent_agencies.id', 'entity_requests.proposed_parent_agency_id')
        .leftJoin('operating_units as parent_ous', 'parent_ous.id', 'entity_requests.proposed_parent_ou_id')
        .select([
            'entity_requests.id',
            'entity_requests.requested_by_id',
            'entity_requests.requested_by_type',
            'entity_requests.requested_by_user_id',
            'entity_requests.proposed_name',
            'entity_requests.proposed_abbr',
            'entity_requests.proposed_classification',
            'entity_requests.proposed_agency_type',
            'entity_requests.proposed_parent_department_id',
            'entity_requests.proposed_parent_agency_id',
            'entity_requests.proposed_parent_ou_id',
            'entity_requests.legal_basis',
            'entity_requests.status',
            'entity_requests.dbm_remarks',
            'entity_requests.resulting_id',
            'entity_requests.created_at',
            'users.name as requested_by_user_name',
            sql<string>`COALESCE(request_departments.name, request_agencies.name, request_ous.name, '')`.as('requested_by_entity_name'),
            'parent_departments.name as proposed_parent_department_name',
            'parent_agencies.name as proposed_parent_agency_name',
            'parent_ous.name as proposed_parent_ou_name',
        ])
        .where('entity_requests.id', '=', id)
        .executeTakeFirst()
}

export async function getPendingEntityRequests() {
    return await db
        .selectFrom('entity_requests')
        .leftJoin('departments as request_departments', 'request_departments.id', 'entity_requests.requested_by_id')
        .leftJoin('agencies as request_agencies', 'request_agencies.id', 'entity_requests.requested_by_id')
        .leftJoin('operating_units as request_ous', 'request_ous.id', 'entity_requests.requested_by_id')
        .leftJoin('users', 'users.id', 'entity_requests.requested_by_user_id')
        .select([
            'entity_requests.id',
            'entity_requests.proposed_name',
            'entity_requests.proposed_abbr',
            'entity_requests.proposed_classification',
            'entity_requests.proposed_agency_type',
            'entity_requests.legal_basis',
            'entity_requests.status',
            'entity_requests.created_at',
            'users.name as requested_by_user_name',
            sql<string>`COALESCE(request_departments.name, request_agencies.name, request_ous.name, '')`.as('requested_by_entity_name'),
        ])
        .where('entity_requests.status', '=', 'pending')
        .orderBy('entity_requests.created_at', 'asc')
        .execute()
}

export async function updateEntityRequest(id: string, updateWith: EntityRequestUpdate): Promise<void> {
    await db
        .updateTable('entity_requests')
        .set(updateWith)
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
}

async function getOperatingUnitDescendantIds(rootOuId: string): Promise<string[]> {
    const descendantIds: string[] = []
    let frontier = [rootOuId]

    while (frontier.length > 0) {
        const children = await db
            .selectFrom('operating_units')
            .select('id')
            .where('parent_ou_id', 'in', frontier)
            .execute()

        frontier = children.map(child => child.id)
        descendantIds.push(...frontier)
    }

    return descendantIds
}

export async function setEntityAndDescendantsInactive(entityId: string): Promise<void> {
    const entity = await getEntityById(entityId)
    if (!entity) {
        throw new Error('Entity not found')
    }

    await db.transaction().execute(async (trx) => {
        if (entity.type === 'department') {
            await trx
                .updateTable('departments')
                .set({ status: 'inactive' })
                .where('id', '=', entityId)
                .execute()

            const agencies = await trx
                .selectFrom('agencies')
                .select('id')
                .where('department_id', '=', entityId)
                .execute()

            const agencyIds = agencies.map(agency => agency.id)

            if (agencyIds.length > 0) {
                await trx
                    .updateTable('agencies')
                    .set({ status: 'inactive' })
                    .where('id', 'in', agencyIds)
                    .execute()

                await trx
                    .updateTable('operating_units')
                    .set({ status: 'inactive' })
                    .where('agency_id', 'in', agencyIds)
                    .execute()
            }

            return
        }

        if (entity.type === 'agency') {
            await trx
                .updateTable('agencies')
                .set({ status: 'inactive' })
                .where('id', '=', entityId)
                .execute()

            await trx
                .updateTable('operating_units')
                .set({ status: 'inactive' })
                .where('agency_id', '=', entityId)
                .execute()

            return
        }

        if (entity.type === 'operating_unit') {
            const descendantIds = await getOperatingUnitDescendantIds(entityId)
            const idsToInactivate = [entityId, ...descendantIds]

            await trx
                .updateTable('operating_units')
                .set({ status: 'inactive' })
                .where('id', 'in', idsToInactivate)
                .execute()
        }
    })
}
