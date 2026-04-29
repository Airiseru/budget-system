import { db } from '../database'
import { Form, NewForm } from '../../../types/forms'

export interface FormFilters {
    fiscal_year?: number;
    auth_status?: string;
    type?: string;
    limit?: number;
    offset?: number;
}

export async function getFormById(id: string) {
    return await db
        .selectFrom('forms')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirstOrThrow()
}

export async function findFormsByParentId(id: string) {
    return await db
        .selectFrom('forms')
        .where('parent_form_id', '=', id)
        .selectAll()
        .orderBy('version', 'desc')
        .executeTakeFirst()
}

export async function getFormVersionFamily(id: string) {
    const form = await getFormById(id)
    const originalFormId = form.parent_form_id ?? form.id

    const forms = await db
        .selectFrom('forms')
        .select([
            'id',
            'entity_id',
            'type',
            'fiscal_year',
            'parent_form_id',
            'version',
            'codename',
            'auth_status',
            'created_at',
            'updated_at'
        ])
        .where(({ eb, or }) => or([
            eb('forms.id', '=', originalFormId),
            eb('forms.parent_form_id', '=', originalFormId)
        ]))
        .orderBy('version', 'asc')
        .execute()

    return {
        originalFormId,
        forms
    }
}

export async function hasApprovedFormInFamily(id: string) {
    const { forms } = await getFormVersionFamily(id)
    return forms.some(form => form.auth_status === 'approved')
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

export async function updateFormParent(formId: string, parentFormId: string) {
    return await db
        .updateTable('forms')
        .set({ parent_form_id: parentFormId })
        .where('id', '=', formId)
        .executeTakeFirstOrThrow()
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
        ])

    // Apply optional filters dynamically
    if (filters.fiscal_year) query = query.where('forms.fiscal_year', '=', filters.fiscal_year);
    if (filters.auth_status) query = query.where('forms.auth_status', '=', filters.auth_status);
    if (filters.type) query = query.where('forms.type', '=', filters.type);

    const allForms = await query
        .orderBy('forms.updated_at', 'desc')
        .execute()

    const latestByFamily = new Map<string, (typeof allForms)[number]>()

    for (const form of allForms) {
        const familyId = form.parent_form_id ?? form.id
        const current = latestByFamily.get(familyId)

        if (!current || form.version > current.version) {
            latestByFamily.set(familyId, form)
        }
    }

    const latestForms = Array.from(latestByFamily.values())
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

    const totalCount = latestForms.length
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0
    const forms = latestForms.slice(offset, offset + limit)

    return {
        forms,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
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
    const validEntityIds: string[] = [entityId]

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

export async function getFormTypeById(id: string) {
    return await db
        .selectFrom('forms')
        .select('type')
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
}
