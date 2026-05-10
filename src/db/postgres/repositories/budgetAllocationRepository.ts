import { db } from '../database'
import { NewAllocationWorkflowLog, NewBudgetAllocation, BudgetAllocation, BudgetAllocationUpdate } from '@/src/types/line_items'
import { sql } from 'kysely'

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

export async function listBudgetAllocationsByYear(year: number, tier: 1 | 2 = 1) {
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
        .where('budget_allocations.budget_cycle_year', '=', year)
        .where('budget_allocations.tier', '=', tier)
        .orderBy('budget_allocations.updated_at', 'desc')
        .execute() as BudgetAllocationListItem[]
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
