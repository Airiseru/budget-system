import { db } from '../database'

import { NewRetireeRecord, NewRetireesList } from '@/src/types/retirees';

export async function createRetireeSubmission(
    entityId: string,
    listData: Omit<NewRetireesList, 'id' | 'submission_date' | 'created_at' | 'updated_at'>,
    retirees: Omit<NewRetireeRecord, 'id' | 'retirees_list_id'>[],
    authStatus: string
) {
    return await db.transaction().execute(async (trx) => {
        // 1. Create Base Form (The Envelope)
        const form = await trx.insertInto('forms')
            .values({ 
                entity_id: entityId, 
                type: 'bp_retiree',
                codename: 'BP Form 205', 
                auth_status: authStatus
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        // 2. Create Retirees List Metadata
        const list = await trx.insertInto('retirees_list')
            .values({
                id: form.id, // Primary key is shared with the base form
                fiscal_year: listData.fiscal_year,
                is_mandatory: listData.is_mandatory,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
        
        // 3. Insert Individual Retiree Records
        if (retirees.length > 0) {
            await trx.insertInto('retirees')
                .values(retirees.map(retiree => ({
                    ...retiree,
                    retirees_list_id: list.id,
                    // Ensure decimals/numeric fields are handled if passed as strings
                })))
                .execute();
        }

        return { formId: form.id, listId: list.id };
    });
}

export async function getRetireesFormById(id: string) {
    const list = await db
        .selectFrom('retirees_list')
        .innerJoin('forms', 'forms.id', 'retirees_list.id')
        .where('retirees_list.id', '=', id)
        .select([
            'retirees_list.id',
            'retirees_list.fiscal_year',
            'retirees_list.is_mandatory',
            'forms.auth_status',
            'forms.entity_id'
        ])
        .executeTakeFirst();

    if (!list) return null;

    const retirees = await db
        .selectFrom('retirees')
        .where('retirees_list_id', '=', id)
        .selectAll()
        .orderBy('retirement_effectivity', 'asc')
        .execute();

    return {
        ...list,
        retirees
    };
}

export async function getAllRetireeSubmissions(
    userId: string,
    entityType: string,
    entityId: string
) {
    let query = db
        .selectFrom('retirees_list')
        .innerJoin('forms', 'forms.id', 'retirees_list.id')
        .select([
            'retirees_list.id as id',
            'retirees_list.fiscal_year as fiscal_year',
            'retirees_list.is_mandatory as is_mandatory',
            'retirees_list.submission_date as submission_date',
            'forms.auth_status as auth_status',
            'forms.entity_id as entity_id'
        ]);

    if (entityType !== 'admin') {
        // Use the explicit table name in the where clause
        query = query.where('forms.entity_id', '=', entityId);
    }

    return await query
        .orderBy('retirees_list.fiscal_year', 'desc')
        .execute();
}

export async function updateRetirees(formId: string, retirees: NewRetireeRecord[]) {
    return await db.transaction().execute(async (trx) => {
        // 1. Clear existing retirees for this form
        await trx
            .deleteFrom('retirees')
            .where('retirees_list_id', '=', formId)
            .execute();

        // 2. Insert the new set if any exist
        if (retirees.length > 0) {
            const recordsToInsert = retirees.map(r => ({
                ...r,
                retirees_list_id: formId,
                // Ensure ID is generated if not provided
                id: r.id ?? crypto.randomUUID() 
            }));

            await trx
                .insertInto('retirees')
                .values(recordsToInsert)
                .execute();
        }
        
        // 3. Update the timestamp on the parent
        await trx
            .updateTable('retirees_list')
            .set({ updated_at: new Date() })
            .where('id', '=', formId)
            .execute();
    });
}

export async function updateRetireeListMetadata(id: string, data: { fiscal_year?: number; is_mandatory?: boolean }) {
    return await db
        .updateTable('retirees_list')
        .set({
            ...data,
            updated_at: new Date()
        })
        .where('id', '=', id)
        .executeTakeFirst();
}

export async function deleteRetireeForm(id: string) {
    // Only allow deletion if it's still a draft
    return await db
        .deleteFrom('forms')
        .where('id', '=', id)
        .where('auth_status', '=', 'draft')
        .executeTakeFirst();
}