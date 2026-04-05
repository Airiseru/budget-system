import { db } from '../database'
import { Pap, NewPap, PapUpdate } from '../../../types/pap'

// READ
export async function getAllPaps(): Promise<Pap[]> {
    return await db.selectFrom('pap').selectAll().execute()
}

export async function getPapById(id: string): Promise<Pap | null> {
    return await db.selectFrom('pap').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

export async function getPapByEntityId(entityId: string): Promise<Pap[]> {
    return await db.selectFrom('pap').selectAll().where('entity_id', '=', entityId).execute()
}

export async function getPap(criteria: Partial<Pap>): Promise<Pap[]> {
    let query = db.selectFrom('pap')

    if (criteria.category) {
        query = query.where('category', '=', criteria.category)
    }

    if (criteria.project_type !== undefined) {
        query = query.where('project_type', '=', criteria.project_type)
    }

    if (criteria.project_status) {
        query = query.where('project_status', '=', criteria.project_status)
    }

    if (criteria.auth_status !== undefined) {
        query = query.where('auth_status', '=', criteria.auth_status)
    }

    return await query.selectAll().execute()
}

export async function getFormsByPapId(papId: string) {
    return await db
        .selectFrom('forms')
        .innerJoin('form_paps', 'forms.id', 'form_paps.form_id')
        .where('form_paps.pap_id', '=', papId)
        .select([
            'forms.id', 
            'forms.type', 
            'forms.auth_status', 
            'forms.created_at'
        ])
        .execute();
}

// UPDATE
export async function updatePap(id: string, updateWith: PapUpdate): Promise<Pap | null> {
    const result = await db
        .updateTable('pap')
        .set(updateWith)
        .where('id', '=', id)
        .execute()

    if (result) {
        return await getPapById(id)
    }

    return null
}

// CREATE
export async function createPap(pap: NewPap): Promise<Pap> {
    return await db.insertInto('pap').values(pap).returningAll().executeTakeFirstOrThrow()
}

// DELETE
export async function deletePap(id: string): Promise<void> {
    await db.deleteFrom('pap').where('id', '=', id).returningAll().executeTakeFirst()
}