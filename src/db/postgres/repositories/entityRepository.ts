import { db } from '../database'
import { 
    Entity, NewEntity, EntityUpdate,
    User, UserRole, NewUser,  UserUpdate, UserEntity,
    Department, NewDepartment, DepartmentUpdate,
    Agency, NewAgency, AgencyUpdate,
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
    
// USERS
export async function getAllUsers(): Promise<Entity[]> {
    return await db
        .selectFrom('entities')
        .selectAll().where('type', '=', 'user')
        .leftJoin('users', 'entities.id', 'users.entity_id')
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

export async function getEntityOfUser(id: string): Promise<Department | null> {
    const user_entity = await db
        .selectFrom('users')
        .where('id', '=', id)
        .leftJoin('entities', 'users.entity_id', 'entities.id')
        .selectAll()
        .executeTakeFirstOrThrow()

    if (user_entity === null) {
        return null
    }

    if (user_entity.type === 'department') {
        return await getDepartmentById(user_entity.id as string)
    }

    return null
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