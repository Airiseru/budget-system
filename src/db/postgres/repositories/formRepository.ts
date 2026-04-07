import { db } from '../database'
import { Form, NewForm } from '../../../types/forms'

export async function getFormAuthStatus(formId: string) {
    return await db
        .selectFrom('forms')
        .where('id', '=', formId)
        .select([
            'auth_status',
            'entity_id',
            'type'
        ])
        .executeTakeFirstOrThrow()
}

export async function createForm(form: NewForm): Promise<Form> {
    return await db.insertInto('forms').values(form).returningAll().executeTakeFirstOrThrow()
}

export async function updateFormAuthStatus(formId: string, authStatus: string) {
    return await db
        .updateTable('forms')
        .set({ auth_status: authStatus })
        .where('id', '=', formId)
        .execute()
}