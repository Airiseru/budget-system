import { db } from '../database'
import { Pap, NewPap, PapUpdate } from '../../../types/pap'
import { sql } from 'kysely'

export type PapListFilters = {
    entity_id?: string
    entity_ids?: string[]
    category?: 'local' | 'foreign'
    search?: string
    limit?: number
    offset?: number
}

export type PapListItem = Pap & {
    entity_name: string | null
    department_name: string | null
    entity_abbr: string | null
    entity_type: string | null
    full_pap_code: string
}

export type PapEntityOption = {
    id: string
    name: string
    abbr: string | null
    entity_type: string
}

export type PapOption = {
    id: string
    title: string
    entity_id: string | null
    entity_name: string | null
}

export type PapRelatedForm = {
    id: string
    type: string
    codename: string | null
    fiscal_year: number
    parent_form_id: string | null
    version: number
    created_at: Date
    updated_at: Date
    auth_status: string | null
    entity_id: string
    entity_name: string | null
    entity_abbr: string | null
}

export type PapWithEntityDetails = Pap & {
    entity_name: string | null
    entity_abbr: string | null
    entity_type: string | null
    parent_agency_name: string | null
    full_pap_code: string
}

function buildPapFullCode(pap: Pick<
    Pap,
    | 'cost_structure_code'
    | 'organizational_outcome_code'
    | 'program_code'
    | 'subprogram_code'
    | 'identifier_code'
    | 'project_title_code'
    | 'reserved_codes'
>) {
    return [
        pap.cost_structure_code ?? '',
        pap.organizational_outcome_code ?? '',
        pap.program_code ?? '',
        pap.subprogram_code ?? '',
        pap.identifier_code ?? '',
        pap.project_title_code ?? '',
        pap.reserved_codes ?? '',
    ].join('')
}

function createPapBaseQuery() {
    return db
        .selectFrom('paps')
        .leftJoin('entities', 'entities.id', 'paps.entity_id')
        .leftJoin('departments', 'departments.id', 'entities.id')
        .leftJoin('agencies', 'agencies.id', 'entities.id')
        .leftJoin('operating_units', 'operating_units.id', 'entities.id')
        .leftJoin('agencies as parent_agencies', 'parent_agencies.id', 'operating_units.agency_id')
        .leftJoin('departments as agency_departments', 'agency_departments.id', 'agencies.department_id')
        .leftJoin('departments as parent_agency_departments', 'parent_agency_departments.id', 'parent_agencies.department_id')
}

// READ
export async function getAllPaps(): Promise<Pap[]> {
    return await db.selectFrom('paps').selectAll().execute()
}

export async function getPapById(id: string): Promise<Pap | null> {
    return await db.selectFrom('paps').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

export async function getPapWithEntityDetailsById(id: string): Promise<PapWithEntityDetails | null> {
    const pap = await createPapBaseQuery()
        .selectAll('paps')
        .select([
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
            sql<string | null>`COALESCE(departments.abbr, agencies.abbr, operating_units.abbr)`.as('entity_abbr'),
            sql<string | null>`COALESCE(entities.type, '')`.as('entity_type'),
            'parent_agencies.name as parent_agency_name',
        ])
        .where('paps.id', '=', id)
        .executeTakeFirst()

    if (!pap) return null

    return {
        ...pap,
        full_pap_code: buildPapFullCode(pap),
    }
}

export async function getPapByEntityId(entityId: string): Promise<Pap[]> {
    return await db.selectFrom('paps').selectAll().where('entity_id', '=', entityId).execute()
}

export async function getPaginatedPaps(filters: PapListFilters = {}) {
    if (filters.entity_ids && filters.entity_ids.length === 0) {
        const limit = filters.limit ?? 15

        return {
            paps: [],
            totalCount: 0,
            totalPages: Math.ceil(0 / limit),
        }
    }

    let query = createPapBaseQuery()
        .selectAll('paps')
        .select([
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
            sql<string | null>`COALESCE(departments.name, agency_departments.name, parent_agency_departments.name)`.as('department_name'),
            sql<string | null>`COALESCE(departments.abbr, agencies.abbr, operating_units.abbr)`.as('entity_abbr'),
            sql<string | null>`COALESCE(entities.type, '')`.as('entity_type'),
        ])

    if (filters.entity_ids) {
        query = query.where('paps.entity_id', 'in', filters.entity_ids)
    } else if (filters.entity_id) {
        query = query.where('paps.entity_id', '=', filters.entity_id)
    }

    if (filters.category) {
        query = query.where('paps.category', '=', filters.category)
    }

    if (filters.search?.trim()) {
        const search = `%${filters.search.trim()}%`
        query = query.where(({ eb, or }) => or([
            eb('paps.title', 'ilike', search),
            eb('paps.description', 'ilike', search),
            eb('paps.purpose', 'ilike', search),
            eb('paps.beneficiaries', 'ilike', search),
            eb(sql<string>`CONCAT(
                COALESCE(paps.cost_structure_code, ''),
                COALESCE(paps.organizational_outcome_code, ''),
                COALESCE(paps.program_code, ''),
                COALESCE(paps.subprogram_code, ''),
                COALESCE(paps.identifier_code, ''),
                COALESCE(paps.project_title_code, ''),
                COALESCE(paps.reserved_codes, '')
            )`, 'ilike', search),
        ]))
    }

    const allPaps = await query
        .orderBy('paps.updated_at', 'desc')
        .execute()

    const totalCount = allPaps.length
    const limit = filters.limit ?? 15
    const offset = filters.offset ?? 0
    const paps = allPaps
        .slice(offset, offset + limit)
        .map((pap) => ({
            ...pap,
            full_pap_code: buildPapFullCode(pap),
        })) as PapListItem[]

    return {
        paps,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
    }
}

export async function getPapEntityOptions(): Promise<PapEntityOption[]> {
    const rows = await createPapBaseQuery()
        .select([
            'entities.id as id',
            sql<string>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('name'),
            sql<string | null>`COALESCE(departments.abbr, agencies.abbr, operating_units.abbr)`.as('abbr'),
            'entities.type as entity_type',
        ])
        .where('paps.entity_id', 'is not', null)
        .where('entities.id', 'is not', null)
        .groupBy([
            'entities.id',
            'entities.type',
            'departments.name',
            'departments.abbr',
            'agencies.name',
            'agencies.abbr',
            'operating_units.name',
            'operating_units.abbr',
        ])
        .orderBy('name', 'asc')
        .execute()

    return rows
        .filter((row): row is typeof rows[number] & { id: string; entity_type: string } => !!row.id && !!row.entity_type)
        .map((row) => ({
            id: row.id,
            name: row.name,
            abbr: row.abbr,
            entity_type: row.entity_type,
        }))
}

export async function getPapOptions(): Promise<PapOption[]> {
    return await createPapBaseQuery()
        .select([
            'paps.id as id',
            'paps.title as title',
            'paps.entity_id as entity_id',
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
        ])
        .orderBy('paps.title', 'asc')
        .execute()
}

export async function getPap(criteria: Partial<Pap>): Promise<Pap[]> {
    let query = db.selectFrom('paps')

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
    const forms = await db
        .selectFrom('forms')
        .innerJoin('form_paps', 'forms.id', 'form_paps.form_id')
        .leftJoin('entities', 'entities.id', 'forms.entity_id')
        .leftJoin('departments', 'departments.id', 'entities.id')
        .leftJoin('agencies', 'agencies.id', 'entities.id')
        .leftJoin('operating_units', 'operating_units.id', 'entities.id')
        .where('form_paps.pap_id', '=', papId)
        .select([
            'forms.id', 
            'forms.type', 
            'forms.codename',
            'forms.fiscal_year',
            'forms.parent_form_id',
            'forms.version',
            'forms.auth_status', 
            'forms.created_at',
            'forms.updated_at',
            'forms.entity_id',
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
            sql<string | null>`COALESCE(departments.abbr, agencies.abbr, operating_units.abbr)`.as('entity_abbr'),
        ])
        .orderBy('forms.updated_at', 'desc')
        .execute();

    const latestByFamily = new Map<string, PapRelatedForm>()

    for (const form of forms) {
        const familyId = form.parent_form_id ?? form.id
        const current = latestByFamily.get(familyId)

        if (!current || form.version > current.version || (
            form.version === current.version &&
            form.updated_at.getTime() > current.updated_at.getTime()
        )) {
            latestByFamily.set(familyId, form)
        }
    }

    return [...latestByFamily.values()].sort(
        (a, b) => b.updated_at.getTime() - a.updated_at.getTime()
    )
}

export async function getFullCodeByPapId(papId: string) {
    const pap = await db
        .selectFrom('paps')
        .select([
            'cost_structure_code',
            'organizational_outcome_code',
            'program_code',
            'subprogram_code',
            'identifier_code',
            'project_title_code',
            'reserved_codes',
        ])
        .where('id', '=', papId)
        .executeTakeFirst()

    if (!pap) return null

    return buildPapFullCode({
        ...pap,
        identifier_code: pap.identifier_code ?? '1',
    } as Pick<Pap, 'cost_structure_code' | 'organizational_outcome_code' | 'program_code' | 'subprogram_code' | 'identifier_code' | 'project_title_code' | 'reserved_codes'>)
}

// UPDATE
export async function updatePap(id: string, updateWith: PapUpdate): Promise<Pap | null> {
    const result = await db
        .updateTable('paps')
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
    return await db.insertInto('paps').values(pap).returningAll().executeTakeFirstOrThrow()
}

// DELETE
export async function deletePap(id: string): Promise<void> {
    await db.deleteFrom('paps').where('id', '=', id).returningAll().executeTakeFirst()
}
