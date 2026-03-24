import { db } from '../database'
import { 
    Entity,
    NewEntity,
    EntityUpdate,
    Department,
    NewDepartment,
    DepartmentUpdate
} from '../../../types/entities'

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

export async function deleteDepartment(id: string): Promise<void> {
    await db.deleteFrom('departments').where('id', '=', id).returningAll().executeTakeFirst()
}

export async function getAllUsers(): Promise<Entity[]> {
    return await db
        .selectFrom('entities')
        .selectAll().where('type', '=', 'user')
        .leftJoin('users', 'entities.id', 'users.entity_id')
        .execute()
}