import { db } from '../database'
import { TLB_FACTOR } from '@/src/lib/constants';
import { NewRetireeRecord, NewRetireesList } from '@/src/types/retirees';
import { getOperatingUnitDescendantIds } from './entityRepository';

async function createRetireeSubmissionRecord(
    trx: any,
    entityId: string,
    fiscal_year: number,
    listData: Omit<NewRetireesList, 'id' | 'submission_date' | 'created_at' | 'updated_at'>,
    retirees: Omit<NewRetireeRecord, 'id' | 'retirees_list_id'>[],
    authStatus: string,
    parent_form_id?: string,
    version?: number
) {
    const form = await trx.insertInto('forms')
        .values({
            entity_id: entityId,
            type: 'bp_retiree',
            fiscal_year: fiscal_year,
            codename: 'BP Form 205',
            auth_status: authStatus,
            parent_form_id: parent_form_id ?? null,
            version: version ?? 1
        })
        .returning(['id', 'fiscal_year'])
        .executeTakeFirstOrThrow();

    const list = await trx.insertInto('retirees_list')
        .values({
            id: form.id,
            is_mandatory: listData.is_mandatory,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    if (retirees.length > 0) {
        await trx.insertInto('retirees')
            .values(retirees.map(retiree => ({
                ...retiree,
                retirees_list_id: list.id,
                tlb_constant_factor: TLB_FACTOR,
                tlb_amount: retiree.highest_monthly_salary * ((retiree.number_vacation_leave ?? 0) + (retiree.number_sick_leave ?? 0)) * TLB_FACTOR,
            })))
            .execute();
    }

    return { formId: form.id, listId: list.id, createdAt: list.created_at, fiscal_year: form.fiscal_year };
}

export async function createRetireeSubmission(
    entityId: string,
    fiscal_year: number,
    listData: Omit<NewRetireesList, 'id' | 'submission_date' | 'created_at' | 'updated_at'>,
    retirees: Omit<NewRetireeRecord, 'id' | 'retirees_list_id'>[],
    authStatus: string,
    parent_form_id?: string,
    version?: number
) {
    return await db.transaction().execute(async (trx) => {
        return await createRetireeSubmissionRecord(
            trx,
            entityId,
            fiscal_year,
            listData,
            retirees,
            authStatus,
            parent_form_id,
            version
        );
    });
}

export async function getRetireesFormById(id: string) {
    const list = await db
        .selectFrom('retirees_list')
        .innerJoin('forms', 'forms.id', 'retirees_list.id')
        .where('retirees_list.id', '=', id)
        .select([
            'retirees_list.id',
            'retirees_list.is_mandatory',
            'forms.fiscal_year',
            'forms.auth_status',
            'forms.entity_id',
            'forms.parent_form_id',
            'forms.version',
            'retirees_list.updated_at as updated_at'
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
    entityType: string,
    userRole: string,
    entityId: string,
    inDbmModule: boolean = false,
    fiscalYear: number = new Date().getFullYear() + 1,
) {
    let query = db
        .selectFrom('retirees_list')
        .innerJoin('forms', 'forms.id', 'retirees_list.id')
        .select([
            'retirees_list.id as id',
            'retirees_list.is_mandatory as is_mandatory',
            'retirees_list.submission_date as submission_date',
            'forms.fiscal_year as fiscal_year',
            'forms.auth_status as auth_status',
            'forms.entity_id as entity_id',
            'forms.parent_form_id as parent_form_id',
            'forms.version as version'
        ])
        .where('forms.parent_form_id', 'is', null)
        .orderBy('retirees_list.submission_date', 'desc')
    
    if (entityType === "national") {
        return await query.execute()
    }

    // DBM can see everything once form is submitted
    if (userRole === 'dbm' && inDbmModule) {
        return await query
            .where(({ eb, or }) => or([
                eb('forms.auth_status', '=', 'dbm'),
                eb('forms.auth_status', '=', 'done'),
            ]))
            .where('forms.fiscal_year', '=', fiscalYear)
            .execute()
    }

    // Departments can see their own and children forms
    if (entityType === 'department') {
        return await query
            .leftJoin('agencies', 'agencies.id', 'forms.entity_id')
            .leftJoin('operating_units', 'operating_units.id', 'forms.entity_id')
            .where(({ eb, or }) => or([
                eb('forms.entity_id', '=', entityId),
                eb('agencies.department_id', '=', entityId),
                eb('operating_units.agency_id', 'in',
                    db.selectFrom('agencies')
                        .where('department_id', '=', entityId)
                        .select('id')
                ),
            ]))
            .execute()
    }

    // Agencies can see their own and forms of children operating unit
    if (entityType === 'agency') {
        return await query
            .leftJoin('operating_units', 'operating_units.id', 'forms.entity_id')
            .where(({ eb, or }) => or([
                eb('forms.entity_id', '=', entityId),
                eb('operating_units.agency_id', '=', entityId),
            ]))
            .execute()
    }

    if (entityType === 'operating_unit') {
        const descendantOuIds = await getOperatingUnitDescendantIds(entityId)
        return await query
            .where('forms.entity_id', 'in', [entityId, ...descendantOuIds])
            .execute()
    }

    return await query
        .where('forms.entity_id', '=', entityId)
        .execute()
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
                id: r.id ?? crypto.randomUUID(),
                tlb_constant_factor: TLB_FACTOR,
                tlb_amount: r.highest_monthly_salary * ((r.number_vacation_leave ?? 0) + (r.number_sick_leave ?? 0)) * TLB_FACTOR,
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

async function updateRetireeSubmissionRecord(
    trx: any,
    formId: string,
    data: { fiscal_year?: number; is_mandatory?: boolean },
    retirees: NewRetireeRecord[],
    authStatus?: string
) {
    await trx
        .updateTable('forms')
        .set({
            fiscal_year: data.fiscal_year,
            auth_status: authStatus,
            updated_at: new Date()
        })
        .where('id', '=', formId)
        .execute();

    await trx
        .updateTable('retirees_list')
        .set({
            is_mandatory: data.is_mandatory,
            updated_at: new Date()
        })
        .where('id', '=', formId)
        .executeTakeFirst();

    await trx
        .deleteFrom('retirees')
        .where('retirees_list_id', '=', formId)
        .execute();

    if (retirees.length > 0) {
        const recordsToInsert = retirees.map(r => ({
            ...r,
            retirees_list_id: formId,
            id: r.id ?? crypto.randomUUID(),
            tlb_constant_factor: TLB_FACTOR,
            tlb_amount: r.highest_monthly_salary * ((r.number_vacation_leave ?? 0) + (r.number_sick_leave ?? 0)) * TLB_FACTOR,
        }));

        await trx
            .insertInto('retirees')
            .values(recordsToInsert)
            .execute();
    }
}

export async function updateRetireeSubmission(
    formId: string,
    data: { fiscal_year?: number; is_mandatory?: boolean },
    retirees: NewRetireeRecord[],
    authStatus?: string
) {
    return await db.transaction().execute(async (trx) => {
        await updateRetireeSubmissionRecord(trx, formId, data, retirees, authStatus);
        return { success: true };
    });
}

export async function createDbmRetireeOverwrite(
    sourceFormId: string,
    data: { fiscal_year?: number; is_mandatory?: boolean },
    retirees: NewRetireeRecord[],
    authStatus?: string
) {
    return await db.transaction().execute(async (trx) => {
        const sourceForm = await trx
            .selectFrom('forms')
            .select([
                'id',
                'entity_id',
                'parent_form_id',
                'version',
                'auth_status'
            ])
            .where('id', '=', sourceFormId)
            .executeTakeFirstOrThrow();

        const parentFormId = sourceForm.parent_form_id ?? sourceForm.id;

        const existingOverwrite = await trx
            .selectFrom('forms')
            .select(['id'])
            .where('parent_form_id', '=', parentFormId)
            .executeTakeFirst();

        if (existingOverwrite) {
            await updateRetireeSubmissionRecord(trx, existingOverwrite.id, data, retirees, authStatus);

            return {
                formId: existingOverwrite.id,
                created: false
            };
        }

        const created = await createRetireeSubmissionRecord(
            trx,
            sourceForm.entity_id,
            data.fiscal_year ?? new Date().getFullYear() + 1,
            { is_mandatory: data.is_mandatory ?? true },
            retirees.map(({ id: _id, retirees_list_id: _retireesListId, ...retiree }) => retiree),
            authStatus ?? sourceForm.auth_status ?? 'pending_dbm',
            parentFormId,
            (sourceForm.version ?? 1) + 1
        );

        return {
            formId: created.formId,
            created: true
        };
    });
}

export async function deleteRetireeForm(id: string) {
    // Only allow deletion if it's still a draft
    return await db
        .deleteFrom('forms')
        .where('id', '=', id)
        .where('auth_status', '=', 'draft')
        .executeTakeFirst();
}
