import { db } from '../database'
import { 
    Entity, NewEntity,
    User, UserRole,  UserUpdate, UserEntity,
    Department, NewDepartment, DepartmentUpdate,
    Agency, NewAgency, AgencyUpdate, EntitySegments,
    OperatingUnit, NewOperatingUnit, OperatingUnitUpdate
} from '../../../types/entities'
import { Expression, sql } from 'kysely'

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

export async function createDepartment(department: NewDepartment): Promise<Department> {
    const new_entity = await createEntity({type: 'department'})
    department.id = new_entity.id

    return await db.insertInto('departments').values(department).returningAll().executeTakeFirstOrThrow()
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

export async function createAgency(agency: NewAgency, department_id: string | null): Promise<Agency> {
    const new_entity = await createEntity({type: 'agency'})
    agency.id = new_entity.id

    if (department_id === null) {
        return await db.insertInto('agencies').values(agency).returningAll().executeTakeFirstOrThrow()
    }

    return await db.insertInto('agencies').values({ ...agency, department_id }).returningAll().executeTakeFirstOrThrow()
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

export async function getAllOperatingUnitsByAgencyId(agency_id: string): Promise<Partial<OperatingUnit>[]> {
    return await db
        .selectFrom('operating_units')
        .select([
            'operating_units.id as id',
            'operating_units.name as name',
            'operating_units.uacs_code as uacs_code'
        ])
        .where('agency_id', '=', agency_id)
        .execute()
}

export async function createOperatingUnit(operating_unit: NewOperatingUnit, agency_id: string): Promise<OperatingUnit> {
    const new_entity = await createEntity({type: 'operating_unit'})
    operating_unit.id = new_entity.id

    return await db.insertInto('operating_units').values({ ...operating_unit, agency_id }).returningAll().executeTakeFirstOrThrow()
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

export async function getAllEntitySegments() {
    const departments = await db
        .selectFrom('departments')
        .innerJoin('entities', 'entities.id', 'departments.id')
        .select([
            'entities.id as id',
            'entities.type as entity_type',
            'departments.name as name',
            'departments.uacs_code as uacs_code',
        ])
        .execute()

    const agencies = await db
        .selectFrom('agencies')
        .innerJoin('entities', 'entities.id', 'agencies.id')
        .select([
            'entities.id as id',
            'entities.type as entity_type',
            'agencies.name as name',
            'agencies.uacs_code as uacs_code',
            'agencies.type as type',
            'agencies.department_id as department_id',
        ])
        .execute()

    const operatingUnits = await db
        .selectFrom('operating_units')
        .innerJoin('entities', 'entities.id', 'operating_units.id')
        .select([
            'entities.id as id',
            'entities.type as entity_type',
            'operating_units.name as name',
            'operating_units.uacs_code as uacs_code',
        ])
        .execute()

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
            'agencies.type as type',
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
                'operating_units.uacs_code as uacs_code',
            ])
            .where('operating_units.agency_id', 'in', agencyIds)
            .execute()
        : []

    return { agencies, operatingUnits }
}
    
// USERS
export async function getAllUsers(): Promise<Partial<User>[]> {
    return await db
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
        .execute()
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
            'departments.uacs_code as department_uacs_code',
            // agency fields
            'agencies.id as agency_id',
            'agencies.name as agency_name',
            'agencies.department_id as parent_department_id',
            // operating unit fields
            'operating_units.id as operating_unit_id',
            'operating_units.name as operating_unit_name',
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
    await db.deleteFrom('users').where('id', '=', id).returningAll().executeTakeFirst()
}