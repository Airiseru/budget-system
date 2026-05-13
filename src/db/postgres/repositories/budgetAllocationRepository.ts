import { db } from '../database'
import { NewAllocationWorkflowLog, NewBudgetAllocation, BudgetAllocation, BudgetAllocationUpdate } from '@/src/types/line_items'
import { Kysely, Transaction, sql } from 'kysely'
import type { BudgetCyclePhase } from '@/src/types/budget_settings'
import type { ExpenseClass } from '@/src/types/line_items'
import type { Database } from '@/src/types'

type DbExecutor = Kysely<Database> | Transaction<Database>

const ALLOCATION_STATUS_ORDER = [
    'draft',
    'proposed',
    'dbm_approved',
    'nep_approved',
    'gaa_approved',
] as const

function isValidAllocationStatusTransition(
    currentStatus: BudgetAllocation['auth_status'],
    nextStatus: BudgetAllocation['auth_status']
) {
    if (currentStatus === nextStatus) return true
    if (nextStatus === 'rejected') return true
    if (currentStatus === 'rejected') return nextStatus === 'draft'

    const currentIndex = ALLOCATION_STATUS_ORDER.indexOf(currentStatus as (typeof ALLOCATION_STATUS_ORDER)[number])
    const nextIndex = ALLOCATION_STATUS_ORDER.indexOf(nextStatus as (typeof ALLOCATION_STATUS_ORDER)[number])

    return currentIndex !== -1 && nextIndex === currentIndex + 1
}

export type BudgetAllocationListItem = BudgetAllocation & {
    entity_name: string | null
    pap_title: string | null
    item_name: string
    fund_description: string | null
}

export type BudgetAllocationRecord = BudgetAllocationListItem

type ListBudgetAllocationsByYearOptions = {
    year: number
    tier?: 1 | 2
    entityId?: string
    entityIds?: string[]
    papCode?: string
    papCodes?: string[]
    limit?: number
    offset?: number
}

export type AllocationWorkflowLogEntry = {
    id: string
    allocation_id: string
    workflow_stage: string
    remarks: string
    amt_before: number | null
    amt_after: number | null
    performed_by: string
    performed_by_name: string | null
    created_at: Date
}

export type AllocationDashboardFilters = {
    fiscalYear: number
    departmentId?: string
    papId?: string
    expenseClass?: string
    search?: string
    limit?: number
    offset?: number
}

export type AllocationDashboardRow = BudgetAllocation & {
    department_id: string | null
    department_name: string | null
    department_uacs_code: string | null
    agency_id: string | null
    agency_name: string | null
    agency_uacs_code: string | null
    operating_unit_id: string | null
    operating_unit_name: string | null
    operating_unit_uacs_code: string | null
    pap_title: string | null
    pap_project_type: string | null
    pap_uacs_code: string | null
    fund_description: string | null
    item_name: string
    expense_class: string
    expense_class_code: string
    object_code: string
}

export type AllocationDashboardTotals = {
    proposed_total: number
    dbm_rec_total: number
    nep_total: number
    gaa_total: number
}

export type AllocationDashboardAggregates = AllocationDashboardTotals & {
    count: number
}

export type AllocationSignoffSummary = {
    allocation_count: number
    missing_validity_count: number
    dbm_rec_total: number
    nep_total: number
    gaa_total: number
    last_updated_at: Date | null
}

export type BulkValidityUpdateOptions = {
    fiscalYear: number
    expenseClass?: ExpenseClass
    tier?: 1 | 2
    validFrom: Date | null
    validUntil: Date | null
}

export type AllocationValidityTarget = {
    id: string
    valid_from: Date | null
    valid_until: Date | null
}

type PreviousYearGaaLookup = {
    fiscalYear: number
    entityId: string
    papCode: string
    fundCode: string
    tier: 1 | 2
    itemCatalogId: string
}

export async function createBudgetAllocation(values: NewBudgetAllocation) {
    return await db
        .insertInto('budget_allocations')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function updateBudgetAllocation(id: string, values: BudgetAllocationUpdate) {
    if (values.auth_status) {
        const existing = await db
            .selectFrom('budget_allocations')
            .select(['auth_status'])
            .where('id', '=', id)
            .executeTakeFirstOrThrow()

        if (!isValidAllocationStatusTransition(existing.auth_status, values.auth_status)) {
            throw new Error(`Invalid allocation status transition from ${existing.auth_status} to ${values.auth_status}.`)
        }
    }

    return await db
        .updateTable('budget_allocations')
        .set({
            ...values,
            updated_at: new Date(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function getBudgetAllocationById(id: string) {
    return await db
        .selectFrom('budget_allocations')
        .leftJoin('entities', 'entities.id', 'budget_allocations.entity_id')
        .leftJoin('departments', 'departments.id', 'entities.id')
        .leftJoin('agencies', 'agencies.id', 'entities.id')
        .leftJoin('operating_units', 'operating_units.id', 'entities.id')
        .leftJoin('paps', 'paps.id', 'budget_allocations.pap_code')
        .innerJoin('item_catalog', 'item_catalog.id', 'budget_allocations.item_catalog_id')
        .leftJoin('uacs_funding_sources', 'uacs_funding_sources.code', 'budget_allocations.fund_code')
        .selectAll('budget_allocations')
        .select([
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
            'paps.title as pap_title',
            'item_catalog.name as item_name',
            'uacs_funding_sources.description as fund_description',
        ])
        .where('budget_allocations.id', '=', id)
        .executeTakeFirst() as BudgetAllocationRecord | undefined
}

export async function findPreviousYearGaaAmount({
    fiscalYear,
    entityId,
    papCode,
    fundCode,
    tier,
    itemCatalogId,
}: PreviousYearGaaLookup) {
    const previousYear = fiscalYear - 1

    const match = await db
        .selectFrom('budget_allocations')
        .select(['gaa_amt'])
        .where('budget_cycle_year', '=', previousYear)
        .where('entity_id', '=', entityId)
        .where('pap_code', '=', papCode)
        .where('fund_code', '=', fundCode)
        .where('tier', '=', tier)
        .where('item_catalog_id', '=', itemCatalogId)
        .orderBy('updated_at', 'desc')
        .executeTakeFirst()

    return Number(match?.gaa_amt ?? 0)
}

export async function listBudgetAllocationsByYear({
    year,
    tier = 1,
    entityId,
    entityIds,
    papCode,
    papCodes,
    limit,
    offset,
}: ListBudgetAllocationsByYearOptions) {
    let query = db
        .selectFrom('budget_allocations')
        .leftJoin('entities', 'entities.id', 'budget_allocations.entity_id')
        .leftJoin('departments', 'departments.id', 'entities.id')
        .leftJoin('agencies', 'agencies.id', 'entities.id')
        .leftJoin('operating_units', 'operating_units.id', 'entities.id')
        .leftJoin('agencies as parent_agencies', 'parent_agencies.id', 'operating_units.agency_id')
        .leftJoin('departments as agency_departments', 'agency_departments.id', 'agencies.department_id')
        .leftJoin('departments as parent_agency_departments', 'parent_agency_departments.id', 'parent_agencies.department_id')
        .leftJoin('operating_units as parent_operating_units', 'parent_operating_units.id', 'operating_units.parent_ou_id')
        .leftJoin('paps', 'paps.id', 'budget_allocations.pap_code')
        .innerJoin('item_catalog', 'item_catalog.id', 'budget_allocations.item_catalog_id')
        .leftJoin('uacs_funding_sources', 'uacs_funding_sources.code', 'budget_allocations.fund_code')
        .selectAll('budget_allocations')
        .select([
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
            'paps.title as pap_title',
            'item_catalog.name as item_name',
            'uacs_funding_sources.description as fund_description',
        ])
        .where('budget_allocations.budget_cycle_year', '=', year)
        .where('budget_allocations.tier', '=', tier)

    if (entityIds && entityIds.length > 0) {
        query = query.where('budget_allocations.entity_id', 'in', entityIds)
    } else if (entityId) {
        query = query.where('budget_allocations.entity_id', '=', entityId)
    }

    if (papCodes && papCodes.length > 0) {
        query = query.where('budget_allocations.pap_code', 'in', papCodes)
    } else if (papCode) {
        query = query.where('budget_allocations.pap_code', '=', papCode)
    }

    query = query
        .orderBy(sql`CONCAT(
            COALESCE(departments.uacs_code, agency_departments.uacs_code, parent_agency_departments.uacs_code, '00'),
            COALESCE(agencies.uacs_code, parent_agencies.uacs_code, '000'),
            CASE
                WHEN operating_units.id IS NULL THEN '00'
                WHEN operating_units.parent_ou_id IS NULL THEN COALESCE(operating_units.uacs_code, '00')
                ELSE COALESCE(parent_operating_units.uacs_code, '00')
            END,
            CASE
                WHEN operating_units.id IS NULL THEN '00000'
                WHEN operating_units.parent_ou_id IS NULL THEN '00000'
                ELSE COALESCE(operating_units.uacs_code, '00000')
            END
        )`, 'asc')
        .orderBy(sql`CONCAT(
            COALESCE(paps.cost_structure_code, ''),
            COALESCE(paps.organizational_outcome_code, ''),
            COALESCE(paps.program_code, ''),
            COALESCE(paps.subprogram_code, ''),
            COALESCE(paps.identifier_code, ''),
            COALESCE(paps.project_title_code, ''),
            COALESCE(paps.reserved_codes, '')
        )`, 'asc')
        .orderBy('item_catalog.uacs_obj_code', 'asc')
        .orderBy('budget_allocations.updated_at', 'desc')

    if (typeof limit === 'number') {
        query = query.limit(limit)
    }

    if (typeof offset === 'number') {
        query = query.offset(offset)
    }

    return await query.execute() as BudgetAllocationListItem[]
}

export async function countBudgetAllocationsByYear({
    year,
    tier = 1,
    entityId,
    entityIds,
    papCode,
    papCodes,
}: Omit<ListBudgetAllocationsByYearOptions, 'limit' | 'offset'>) {
    let query = db
        .selectFrom('budget_allocations')
        .select(({ fn }) => fn.count<string>('budget_allocations.id').as('count'))
        .where('budget_allocations.budget_cycle_year', '=', year)
        .where('budget_allocations.tier', '=', tier)

    if (entityIds && entityIds.length > 0) {
        query = query.where('budget_allocations.entity_id', 'in', entityIds)
    } else if (entityId) {
        query = query.where('budget_allocations.entity_id', '=', entityId)
    }

    if (papCodes && papCodes.length > 0) {
        query = query.where('budget_allocations.pap_code', 'in', papCodes)
    } else if (papCode) {
        query = query.where('budget_allocations.pap_code', '=', papCode)
    }

    const result = await query.executeTakeFirst()
    return Number(result?.count ?? 0)
}

export async function listAllocationWorkflowLogs(allocationId: string) {
    return await db
        .selectFrom('allocation_workflow_logs')
        .leftJoin('users', 'users.id', 'allocation_workflow_logs.performed_by')
        .select([
            'allocation_workflow_logs.id',
            'allocation_workflow_logs.allocation_id',
            'allocation_workflow_logs.workflow_stage',
            'allocation_workflow_logs.remarks',
            'allocation_workflow_logs.amt_before',
            'allocation_workflow_logs.amt_after',
            'allocation_workflow_logs.performed_by',
            'allocation_workflow_logs.created_at',
            'users.name as performed_by_name',
        ])
        .where('allocation_workflow_logs.allocation_id', '=', allocationId)
        .orderBy('allocation_workflow_logs.created_at', 'desc')
        .execute() as AllocationWorkflowLogEntry[]
}

export async function createAllocationWorkflowLog(values: NewAllocationWorkflowLog) {
    return await db
        .insertInto('allocation_workflow_logs')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function createAllocationWorkflowLogs(values: NewAllocationWorkflowLog[]) {
    if (values.length === 0) return []

    return await db
        .insertInto('allocation_workflow_logs')
        .values(values)
        .returningAll()
        .execute()
}

export async function seedAllocationPhaseDefaults(
    fiscalYear: number,
    phase: BudgetCyclePhase
) {
    return await seedAllocationPhaseDefaultsWithExecutor(fiscalYear, phase, db)
}

export async function seedAllocationPhaseDefaultsWithExecutor(
    fiscalYear: number,
    phase: BudgetCyclePhase,
    executor: DbExecutor
) {
    if (phase === 'presidential_approval') {
        await executor
                .updateTable('budget_allocations')
                .set({
                    nep_amt: sql`budget_allocations.dbm_rec_amt`,
                    updated_at: sql`now()`,
                })
                .where('budget_cycle_year', '=', fiscalYear)
                .where('nep_amt', '=', 0)
                .where(({ exists, not, selectFrom }) =>
                    not(
                        exists(
                            selectFrom('allocation_workflow_logs')
                                .select('allocation_workflow_logs.id')
                                .whereRef('allocation_workflow_logs.allocation_id', '=', 'budget_allocations.id')
                                .where('allocation_workflow_logs.workflow_stage', '=', 'presidential_review')
                        )
                    )
                )
                .execute()

        await executor
                .updateTable('budget_allocations')
                .set({
                    auth_status: 'dbm_approved',
                    updated_at: sql`now()`,
                })
                .where('budget_cycle_year', '=', fiscalYear)
                .where('auth_status', '=', 'proposed')
                .execute()

        await executor
                .updateTable('budget_allocations')
                .set({
                    auth_status: 'dbm_approved',
                    updated_at: sql`now()`,
                })
                .where('budget_cycle_year', '=', fiscalYear)
                .where('tier', '=', 1)
                .where('auth_status', '=', 'draft')
                .execute()
    }

    if (phase === 'legislative_deliberation') {
        await executor
            .updateTable('budget_allocations')
            .set({
                gaa_amt: sql`budget_allocations.nep_amt`,
                updated_at: sql`now()`,
            })
            .where('budget_cycle_year', '=', fiscalYear)
            .where('gaa_amt', '=', 0)
            .where(({ exists, not, selectFrom }) =>
                not(
                    exists(
                        selectFrom('allocation_workflow_logs')
                            .select('allocation_workflow_logs.id')
                            .whereRef('allocation_workflow_logs.allocation_id', '=', 'budget_allocations.id')
                            .where('allocation_workflow_logs.workflow_stage', '=', 'congressional_bicam')
                    )
                )
            )
            .execute()
    }
}

export async function updateAllocationStatusForYear(
    fiscalYear: number,
    fromStatuses: BudgetAllocation['auth_status'][],
    toStatus: BudgetAllocation['auth_status']
) {
    return await updateAllocationStatusForYearWithExecutor(fiscalYear, fromStatuses, toStatus, db)
}

export async function updateAllocationStatusForYearWithExecutor(
    fiscalYear: number,
    fromStatuses: BudgetAllocation['auth_status'][],
    toStatus: BudgetAllocation['auth_status'],
    executor: DbExecutor
) {
    if (fromStatuses.length === 0) return

    await executor
        .updateTable('budget_allocations')
        .set({
            auth_status: toStatus,
            updated_at: sql`now()`,
        })
        .where('budget_cycle_year', '=', fiscalYear)
        .where('auth_status', 'in', fromStatuses)
        .execute()
}

export async function getAllocationSignoffSummary(fiscalYear: number) {
    const summary = await db
        .selectFrom('budget_allocations')
        .select(({ fn }) => [
            fn.count<string>('id').as('allocation_count'),
            sql<number>`SUM(CASE WHEN valid_from IS NULL OR valid_until IS NULL THEN 1 ELSE 0 END)`.as('missing_validity_count'),
            fn.sum<number>('dbm_rec_amt').as('dbm_rec_total'),
            fn.sum<number>('nep_amt').as('nep_total'),
            fn.sum<number>('gaa_amt').as('gaa_total'),
            fn.max<Date>('updated_at').as('last_updated_at'),
        ])
        .where('budget_cycle_year', '=', fiscalYear)
        .executeTakeFirst()

    return {
        allocation_count: Number(summary?.allocation_count ?? 0),
        missing_validity_count: Number(summary?.missing_validity_count ?? 0),
        dbm_rec_total: Number(summary?.dbm_rec_total ?? 0),
        nep_total: Number(summary?.nep_total ?? 0),
        gaa_total: Number(summary?.gaa_total ?? 0),
        last_updated_at: summary?.last_updated_at ?? null,
    } as AllocationSignoffSummary
}

export async function countAllocationsMissingValidityByYear(fiscalYear: number) {
    const result = await db
        .selectFrom('budget_allocations')
        .select(({ fn }) => fn.count<string>('id').as('count'))
        .where('budget_cycle_year', '=', fiscalYear)
        .where(({ or, eb }) =>
            or([
                eb('valid_from', 'is', null),
                eb('valid_until', 'is', null),
            ])
        )
        .executeTakeFirst()

    return Number(result?.count ?? 0)
}

export async function bulkUpdateAllocationValidity({
    fiscalYear,
    expenseClass,
    tier,
    validFrom,
    validUntil,
}: BulkValidityUpdateOptions) {
    let query = db
        .updateTable('budget_allocations')
        .set({
            valid_from: validFrom,
            valid_until: validUntil,
            updated_at: sql`now()`,
        })
        .where('budget_allocations.budget_cycle_year', '=', fiscalYear)

    if (expenseClass) {
        query = query.where('budget_allocations.item_catalog_id', 'in', (eb) =>
            eb
                .selectFrom('item_catalog')
                .select('item_catalog.id')
                .where('item_catalog.expense_class', '=', expenseClass)
        )
    }

    if (tier) {
        query = query.where('budget_allocations.tier', '=', tier)
    }

    return await query.executeTakeFirst()
}

export async function listAllocationsForValidityUpdate(
    fiscalYear: number,
    expenseClass?: ExpenseClass,
    tier?: 1 | 2
) {
    let query = db
        .selectFrom('budget_allocations')
        .select(['id', 'valid_from', 'valid_until'])
        .where('budget_cycle_year', '=', fiscalYear)

    if (expenseClass) {
        query = query.where('item_catalog_id', 'in', (eb) =>
            eb
                .selectFrom('item_catalog')
                .select('item_catalog.id')
                .where('item_catalog.expense_class', '=', expenseClass)
        )
    }

    if (tier) {
        query = query.where('tier', '=', tier)
    }

    return await query.execute() as AllocationValidityTarget[]
}

function buildAllocationDashboardBaseQuery(filters: AllocationDashboardFilters) {
    const departmentId = filters.departmentId
    const papId = filters.papId
    const expenseClass = filters.expenseClass
    const search = filters.search
    let query = db
        .selectFrom('budget_allocations')
        .where('budget_allocations.budget_cycle_year', '=', filters.fiscalYear)

    if (departmentId) {
        query = query.where('budget_allocations.entity_id', 'in', (eb) =>
            eb
                .selectFrom('entities')
                .leftJoin('departments', 'departments.id', 'entities.id')
                .leftJoin('agencies', 'agencies.id', 'entities.id')
                .leftJoin('operating_units', 'operating_units.id', 'entities.id')
                .leftJoin('agencies as ou_agencies', 'ou_agencies.id', 'operating_units.agency_id')
                .select('entities.id')
                .where(({ or, eb }) =>
                    or([
                        eb('departments.id', '=', departmentId),
                        eb('agencies.department_id', '=', departmentId),
                        eb('ou_agencies.department_id', '=', departmentId),
                    ])
                )
        )
    }

    if (papId) {
        query = query.where('budget_allocations.pap_code', '=', papId)
    }

    if (expenseClass || search) {
        query = query.where('budget_allocations.item_catalog_id', 'in', (eb) => {
            let itemQuery = eb
                .selectFrom('item_catalog')
                .select('item_catalog.id')

            if (expenseClass) {
                itemQuery = itemQuery.where('item_catalog.expense_class', '=', expenseClass as 'PS' | 'MOOE' | 'CO' | 'FINEX')
            }

            if (search) {
                itemQuery = itemQuery.where('item_catalog.name', 'ilike', `%${search}%`)
            }

            return itemQuery
        })
    }

    return query
}

export async function getAllocationDashboardRows(filters: AllocationDashboardFilters) {
    let query = buildAllocationDashboardBaseQuery(filters)
        .leftJoin('entities', 'entities.id', 'budget_allocations.entity_id')
        .leftJoin('departments', 'departments.id', 'entities.id')
        .leftJoin('agencies', 'agencies.id', 'entities.id')
        .leftJoin('operating_units', 'operating_units.id', 'entities.id')
        .leftJoin('agencies as parent_agencies', 'parent_agencies.id', 'operating_units.agency_id')
        .leftJoin('departments as agency_departments', 'agency_departments.id', 'agencies.department_id')
        .leftJoin('departments as parent_agency_departments', 'parent_agency_departments.id', 'parent_agencies.department_id')
        .leftJoin('operating_units as parent_operating_units', 'parent_operating_units.id', 'operating_units.parent_ou_id')
        .leftJoin('paps', 'paps.id', 'budget_allocations.pap_code')
        .innerJoin('item_catalog', 'item_catalog.id', 'budget_allocations.item_catalog_id')
        .leftJoin('uacs_funding_sources', 'uacs_funding_sources.code', 'budget_allocations.fund_code')
        .selectAll('budget_allocations')
        .select([
            sql<string | null>`COALESCE(departments.id, agency_departments.id, parent_agency_departments.id)`.as('department_id'),
            sql<string | null>`COALESCE(departments.name, agency_departments.name, parent_agency_departments.name)`.as('department_name'),
            sql<string | null>`COALESCE(departments.uacs_code, agency_departments.uacs_code, parent_agency_departments.uacs_code)`.as('department_uacs_code'),
            sql<string | null>`COALESCE(agencies.id, parent_agencies.id)`.as('agency_id'),
            sql<string | null>`COALESCE(agencies.name, parent_agencies.name)`.as('agency_name'),
            sql<string | null>`COALESCE(agencies.uacs_code, parent_agencies.uacs_code)`.as('agency_uacs_code'),
            sql<string | null>`operating_units.id`.as('operating_unit_id'),
            sql<string | null>`CASE
                WHEN operating_units.id IS NULL THEN NULL
                WHEN operating_units.parent_ou_id IS NULL THEN operating_units.name
                ELSE operating_units.name
            END`.as('operating_unit_name'),
            sql<string | null>`CASE
                WHEN operating_units.id IS NULL THEN NULL
                WHEN operating_units.parent_ou_id IS NULL THEN CONCAT(COALESCE(operating_units.uacs_code, '00'), '00000')
                ELSE CONCAT(COALESCE(parent_operating_units.uacs_code, '00'), COALESCE(operating_units.uacs_code, '00000'))
            END`.as('operating_unit_uacs_code'),
            'paps.title as pap_title',
            'paps.project_type as pap_project_type',
            sql<string | null>`CONCAT(
                COALESCE(paps.cost_structure_code, ''),
                COALESCE(paps.organizational_outcome_code, ''),
                COALESCE(paps.program_code, ''),
                COALESCE(paps.subprogram_code, ''),
                COALESCE(paps.identifier_code, ''),
                COALESCE(paps.project_title_code, ''),
                COALESCE(paps.reserved_codes, '')
            )`.as('pap_uacs_code'),
            'uacs_funding_sources.description as fund_description',
            'item_catalog.name as item_name',
            'item_catalog.expense_class as expense_class',
            'item_catalog.expense_class_code as expense_class_code',
            'item_catalog.uacs_obj_code as object_code',
        ])
        .orderBy(sql`COALESCE(departments.uacs_code, agency_departments.uacs_code, parent_agency_departments.uacs_code)`, 'asc')
        .orderBy(sql`COALESCE(agencies.uacs_code, parent_agencies.uacs_code)`, 'asc')
        .orderBy(sql`CASE
            WHEN operating_units.id IS NULL THEN '0000000'
            WHEN operating_units.parent_ou_id IS NULL THEN CONCAT(COALESCE(operating_units.uacs_code, '00'), '00000')
            ELSE CONCAT(COALESCE(parent_operating_units.uacs_code, '00'), COALESCE(operating_units.uacs_code, '00000'))
        END`, 'asc')
        .orderBy(sql`CONCAT(
            COALESCE(paps.cost_structure_code, ''),
            COALESCE(paps.organizational_outcome_code, ''),
            COALESCE(paps.program_code, ''),
            COALESCE(paps.subprogram_code, ''),
            COALESCE(paps.identifier_code, ''),
            COALESCE(paps.project_title_code, ''),
            COALESCE(paps.reserved_codes, '')
        )`, 'asc')
        .orderBy('item_catalog.uacs_obj_code', 'asc')
        .orderBy('item_catalog.name', 'asc')

    if (typeof filters.limit === 'number') {
        query = query.limit(filters.limit)
    }

    if (typeof filters.offset === 'number') {
        query = query.offset(filters.offset)
    }

    return await query.execute() as AllocationDashboardRow[]
}

export async function getAllocationDashboardAggregates(
    filters: Omit<AllocationDashboardFilters, 'limit' | 'offset'>
) {
    const result = await buildAllocationDashboardBaseQuery(filters)
        .select(({ fn }) => [
            fn.count<string>('budget_allocations.id').as('count'),
            fn.sum<number>('budget_allocations.proposed_amt').as('proposed_total'),
            fn.sum<number>('budget_allocations.dbm_rec_amt').as('dbm_rec_total'),
            fn.sum<number>('budget_allocations.nep_amt').as('nep_total'),
            fn.sum<number>('budget_allocations.gaa_amt').as('gaa_total'),
        ])
        .executeTakeFirst()

    return {
        count: Number(result?.count ?? 0),
        proposed_total: Number(result?.proposed_total ?? 0),
        dbm_rec_total: Number(result?.dbm_rec_total ?? 0),
        nep_total: Number(result?.nep_total ?? 0),
        gaa_total: Number(result?.gaa_total ?? 0),
    } as AllocationDashboardAggregates
}

export async function countAllocationDashboardRows(filters: AllocationDashboardFilters) {
    return (await getAllocationDashboardAggregates(filters)).count
}

export async function getAllocationDashboardTotals(filters: Omit<AllocationDashboardFilters, 'limit' | 'offset'>) {
    const { proposed_total, dbm_rec_total, nep_total, gaa_total } =
        await getAllocationDashboardAggregates(filters)

    return {
        proposed_total,
        dbm_rec_total,
        nep_total,
        gaa_total,
    } as AllocationDashboardTotals
}
