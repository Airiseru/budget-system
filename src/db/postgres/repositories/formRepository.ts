import { db } from '../database'
import { Form, NewForm } from '../../../types/forms'

export interface FormFilters {
    fiscal_year?: number;
    auth_status?: string;
    type?: string;
    limit?: number;
    offset?: number;
}

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
    const date = new Date()
    const res = await db
        .updateTable('forms')
        .set({ auth_status: authStatus, updated_at: date })
        .where('id', '=', formId)
        .execute()

    return {
        ...res,
        updated_at: date
    }
}

export async function getAllForms(filters: FormFilters = {}) {
    let query = db
        .selectFrom('forms')
        .leftJoin('departments', 'forms.entity_id', 'departments.id')
        .leftJoin('agencies', 'forms.entity_id', 'agencies.id')
        .leftJoin('operating_units', 'forms.entity_id', 'operating_units.id')
        .selectAll('forms')
        // Dynamically pull the correct name and abbreviation
        .select((eb) => [
            eb.fn.coalesce(
                'departments.name',
                'agencies.name',
                'operating_units.name'
            ).as('entity_name'),
            
            eb.fn.coalesce(
                'departments.abbr',
                'agencies.abbr',
                'operating_units.abbr'
            ).as('entity_abbr')
        ]);

    // Apply optional filters dynamically
    if (filters.fiscal_year) query = query.where('forms.fiscal_year', '=', filters.fiscal_year);
    if (filters.auth_status) query = query.where('forms.auth_status', '=', filters.auth_status);
    if (filters.type) query = query.where('forms.type', '=', filters.type);

    const countResult = await query
        .clearSelect()
        .select((eb) => eb.fn.count<number>('forms.id').as('total_count'))
        .executeTakeFirst()
        
    const totalCount = Number(countResult?.total_count || 0);

    // 2. Execute the paginated query
    const forms = await query
        .orderBy('forms.created_at', 'desc')
        .limit(filters.limit ?? 50) 
        .offset(filters.offset ?? 0)
        .execute()

    return {
        forms,
        totalCount,
        totalPages: Math.ceil(totalCount / (filters.limit ?? 50))
    }
}

export async function getFormsByEntity(
    entityId: string, 
    filters: FormFilters = {}
) {
    // Get the entity type
    const entity = await db
        .selectFrom("entities")
        .where("id", "=", entityId)
        .select("type")
        .executeTakeFirstOrThrow()

    const entityType = entity.type

    // If national, get all forms
    if (entityType === "national") {
        return getAllForms(filters)
    }

    // Initialize our array of valid IDs with the parent entity itself
    let validEntityIds: string[] = [entityId]

    // Entity hierarchy
    if (entityType === "department") {
        const agencies = await db.selectFrom('agencies')
            .select('id')
            .where('department_id', '=', entityId)
            .execute();
            
        const agencyIds = agencies.map(a => a.id);
        validEntityIds.push(...agencyIds)

        if (agencyIds.length > 0) {
            const ous = await db.selectFrom('operating_units')
                .select('id')
                .where('agency_id', 'in', agencyIds)
                .execute();
            validEntityIds.push(...ous.map(o => o.id))
        }
    }

    else if (entityType === "agency") {
        const ous = await db.selectFrom('operating_units')
            .select('id')
            .where('agency_id', '=', entityId)
            .execute();
        validEntityIds.push(...ous.map(o => o.id))
    }

    let query = db
        .selectFrom('forms')
        .selectAll()
        .where('entity_id', 'in', validEntityIds)

    // Apply the optional dynamic filters
    if (filters.fiscal_year) query = query.where('fiscal_year', '=', filters.fiscal_year)
    if (filters.auth_status) query = query.where('auth_status', '=', filters.auth_status)
    if (filters.type) query = query.where('type', '=', filters.type)

    return await query
        .orderBy('created_at', 'desc')
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0)
        .execute()
}