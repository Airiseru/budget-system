import { db } from '../database'
import { Pap, NewPap, PapUpdate } from '../../../types/pap'
import { Kysely, sql, Transaction } from 'kysely'
import { PAP_PROJECT_STATUS_TYPES, PAP_UACS_SEGMENTS, type PAP_PROJECT_TYPE, type PapUacsFieldName } from '@/src/lib/constants'
import type { Database } from '@/src/types'
import { getAccessibleEntityIds } from './entityRepository'

type DbExecutor = Kysely<Database> | Transaction<Database>
type PapUacsValues = Record<PapUacsFieldName, string | null | undefined>
export const UNASSIGNED_PAP_FULL_CODE = '0'.repeat(
    Object.values(PAP_UACS_SEGMENTS).reduce((total, length) => total + length, 0)
)

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
    org_outcome_id: string
    description: string | null
    purpose: string
    beneficiaries: string
    project_type: string | null
    is_infrastructure: boolean | null
    for_ict: boolean | null
    entity_id: string | null
    entity_name: string | null
    project_status: PAP_PROJECT_STATUS_TYPES
}

type PapOptionFilters = {
    projectStatuses?: PAP_PROJECT_STATUS_TYPES[]
    excludeProjectStatuses?: PAP_PROJECT_STATUS_TYPES[]
    excludeFullyRejectedAllocationsForYear?: number
}

type EntityHierarchyPapOptionFilters = {
    includeGlobal?: boolean
    category?: 'local' | 'foreign'
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

export function buildPapFullCode(pap: PapUacsValues) {
    return [
        pap.cost_structure_code ?? '',
        pap.organizational_outcome_code ?? '',
        pap.program_code ?? '',
        pap.subprogram_code ?? '',
        pap.identifier_code ?? '',
        pap.project_title_code ?? '',
        pap.reserved_code ?? '',
    ].join('')
}

export function hasPapUacsUpdate(values: Partial<Record<PapUacsFieldName, unknown>>) {
    return Object.keys(PAP_UACS_SEGMENTS)
        .filter((field) => field !== 'identifier_code')
        .some((field) => values[field as PapUacsFieldName] !== undefined)
}

const papSearchExpression = sql<string>`(
    COALESCE(paps.title, '') || ' ' ||
    COALESCE(paps.description, '') || ' ' ||
    COALESCE(paps.purpose, '') || ' ' ||
    COALESCE(paps.beneficiaries, '') || ' ' ||
    COALESCE(paps.cost_structure_code, '') ||
    COALESCE(paps.organizational_outcome_code, '') ||
    COALESCE(paps.program_code, '') ||
    COALESCE(paps.subprogram_code, '') ||
    COALESCE(paps.identifier_code, '') ||
    COALESCE(paps.project_title_code, '') ||
    COALESCE(paps.reserved_code, '')
)`

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

export async function getPapByFullCode(fullPapCode: string, excludePapId?: string) {
    let query = db
        .selectFrom('paps')
        .select(['id', 'title'])
        .where(sql<string>`
            CONCAT(
                COALESCE(cost_structure_code, ''),
                COALESCE(organizational_outcome_code, ''),
                COALESCE(program_code, ''),
                COALESCE(subprogram_code, ''),
                COALESCE(identifier_code, ''),
                COALESCE(project_title_code, ''),
                COALESCE(reserved_code, '')
            )
        `, '=', fullPapCode)

    if (excludePapId) {
        query = query.where('id', '!=', excludePapId)
    }

    return await query.executeTakeFirst()
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

        // Use GIN index made in PAP to speed up search
        query = query.where(({ eb }) => eb(papSearchExpression, 'ilike', search))
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

export async function getPapOptions(filters: PapOptionFilters = {}): Promise<PapOption[]> {
    let query = createPapBaseQuery()
        .select([
            'paps.id as id',
            'paps.title as title',
            'paps.org_outcome_id as org_outcome_id',
            'paps.description as description',
            'paps.purpose as purpose',
            'paps.beneficiaries as beneficiaries',
            'paps.project_type as project_type',
            sql<boolean | null>`(
                SELECT pp.is_infrastructure
                FROM form_paps fp
                INNER JOIN project_proposals pp ON pp.id = fp.form_id
                INNER JOIN forms f ON f.id = fp.form_id
                WHERE fp.pap_id = paps.id
                ORDER BY f.created_at DESC
                LIMIT 1
            )`.as('is_infrastructure'),
            sql<boolean | null>`(
                SELECT pp.for_ict
                FROM form_paps fp
                INNER JOIN project_proposals pp ON pp.id = fp.form_id
                INNER JOIN forms f ON f.id = fp.form_id
                WHERE fp.pap_id = paps.id
                ORDER BY f.created_at DESC
                LIMIT 1
            )`.as('for_ict'),
            'paps.entity_id as entity_id',
            'paps.project_status as project_status',
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
        ])

    if (filters.projectStatuses?.length) {
        query = query.where('paps.project_status', 'in', filters.projectStatuses)
    }

    if (filters.excludeProjectStatuses?.length) {
        query = query.where('paps.project_status', 'not in', filters.excludeProjectStatuses)
    }

    if (filters.excludeFullyRejectedAllocationsForYear) {
        query = query.where(sql<boolean>`
            NOT EXISTS (
                SELECT 1
                FROM budget_allocations AS pap_allocations
                WHERE pap_allocations.pap_code = paps.id
                  AND pap_allocations.budget_cycle_year = ${filters.excludeFullyRejectedAllocationsForYear}
            )
            OR EXISTS (
                SELECT 1
                FROM budget_allocations AS pap_allocations
                WHERE pap_allocations.pap_code = paps.id
                  AND pap_allocations.budget_cycle_year = ${filters.excludeFullyRejectedAllocationsForYear}
                  AND pap_allocations.auth_status <> 'rejected'
            )
        `)
    }

    return await query.orderBy('paps.title', 'asc').execute()
}

export async function getPapOptionsForEntityHierarchy(
    entityId: string,
    filters: EntityHierarchyPapOptionFilters = {}
): Promise<PapOption[]> {
    const accessibleEntityIds = await getAccessibleEntityIds(entityId)
    const includeGlobal = filters.includeGlobal ?? true

    let query = createPapBaseQuery()
        .select([
            'paps.id as id',
            'paps.title as title',
            'paps.org_outcome_id as org_outcome_id',
            'paps.description as description',
            'paps.purpose as purpose',
            'paps.beneficiaries as beneficiaries',
            'paps.project_type as project_type',
            sql<boolean | null>`(
                SELECT pp.is_infrastructure
                FROM form_paps fp
                INNER JOIN project_proposals pp ON pp.id = fp.form_id
                INNER JOIN forms f ON f.id = fp.form_id
                WHERE fp.pap_id = paps.id
                ORDER BY f.created_at DESC
                LIMIT 1
            )`.as('is_infrastructure'),
            sql<boolean | null>`(
                SELECT pp.for_ict
                FROM form_paps fp
                INNER JOIN project_proposals pp ON pp.id = fp.form_id
                INNER JOIN forms f ON f.id = fp.form_id
                WHERE fp.pap_id = paps.id
                ORDER BY f.created_at DESC
                LIMIT 1
            )`.as('for_ict'),
            'paps.entity_id as entity_id',
            'paps.project_status as project_status',
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
        ])

    if (accessibleEntityIds.length > 0) {
        query = includeGlobal
            ? query.where(({ eb, or }) => or([
                eb('paps.entity_id', 'is', null),
                eb('paps.entity_id', 'in', accessibleEntityIds),
            ]))
            : query.where('paps.entity_id', 'in', accessibleEntityIds)
    } else {
        query = includeGlobal
            ? query.where('paps.entity_id', 'is', null)
            : query.where(sql`1`, '=', sql`0`)
    }

    if (filters.category) {
        query = query.where('paps.category', '=', filters.category)
    }

    return await query
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
            'reserved_code',
        ])
        .where('id', '=', papId)
        .executeTakeFirst()

    if (!pap) return null

    return buildPapFullCode({
        ...pap,
        identifier_code: pap.identifier_code ?? '1',
    } as Pick<Pap, 'cost_structure_code' | 'organizational_outcome_code' | 'program_code' | 'subprogram_code' | 'identifier_code' | 'project_title_code' | 'reserved_code'>)
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

export async function updatePapProjectStatusForFormWithExecutor(
    executor: DbExecutor,
    formId: string,
    projectStatus: PAP_PROJECT_STATUS_TYPES
) {
    const linkedPaps = await executor
        .selectFrom('form_paps')
        .select('pap_id')
        .where('form_id', '=', formId)
        .execute()

    if (linkedPaps.length === 0) return { updatedCount: 0 }

    const result = await executor
        .updateTable('paps')
        .set({
            project_status: projectStatus,
            updated_at: new Date(),
        })
        .where('id', 'in', linkedPaps.map((row) => row.pap_id))
        .where('project_status', '=', 'proposed')
        .executeTakeFirst()

    return { updatedCount: Number(result.numUpdatedRows ?? 0) }
}

export async function updatePapProjectTypeForFormWithExecutor(
    executor: DbExecutor,
    formId: string,
    projectType: PAP_PROJECT_TYPE,
) {
    const linkedPaps = await executor
        .selectFrom('form_paps')
        .select('pap_id')
        .where('form_id', '=', formId)
        .execute()

    if (linkedPaps.length === 0) return { updatedCount: 0 }

    const result = await executor
        .updateTable('paps')
        .set({
            project_type: projectType,
            updated_at: new Date(),
        })
        .where('id', 'in', linkedPaps.map((row) => row.pap_id))
        .executeTakeFirst()

    return { updatedCount: Number(result.numUpdatedRows ?? 0) }
}

export async function finalizeProposedPapStatusesAfterGaaWithExecutor(
    executor: DbExecutor,
    fiscalYear: number,
) {
    const rows = await executor
        .selectFrom('paps')
        .leftJoin('budget_allocations', (join) =>
            join
                .onRef('budget_allocations.pap_code', '=', 'paps.id')
                .on('budget_allocations.budget_cycle_year', '=', fiscalYear),
        )
        .select(({ fn }) => [
            'paps.id',
            fn.count<string>('budget_allocations.id').as('allocation_count'),
            sql<string>`SUM(CASE WHEN budget_allocations.gaa_amt > 0 THEN 1 ELSE 0 END)`.as('active_line_item_count'),
        ])
        .where('paps.project_status', '=', 'proposed')
        .groupBy('paps.id')
        .execute()

    const approvedPapIds = rows
        .filter((row) => Number(row.active_line_item_count ?? 0) > 0)
        .map((row) => row.id)
    const rejectedPapIds = rows
        .filter((row) =>
            Number(row.allocation_count ?? 0) > 0 &&
            Number(row.active_line_item_count ?? 0) === 0
        )
        .map((row) => row.id)

    if (approvedPapIds.length > 0) {
        await executor
            .updateTable('paps')
            .set({ project_status: 'approved', updated_at: new Date() })
            .where('id', 'in', approvedPapIds)
            .execute()
    }

    if (rejectedPapIds.length > 0) {
        await executor
            .updateTable('paps')
            .set({ project_status: 'rejected', updated_at: new Date() })
            .where('id', 'in', rejectedPapIds)
            .execute()
    }

    return {
        approvedCount: approvedPapIds.length,
        rejectedCount: rejectedPapIds.length,
    }
}

// CREATE
export async function createPap(pap: NewPap): Promise<Pap> {
    return await db.insertInto('paps').values(pap).returningAll().executeTakeFirstOrThrow()
}

// DELETE
export async function deletePap(id: string): Promise<void> {
    await db.deleteFrom('paps').where('id', '=', id).returningAll().executeTakeFirst()
}
