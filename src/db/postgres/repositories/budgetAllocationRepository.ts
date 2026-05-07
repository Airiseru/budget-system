import { db } from '../database'
import { NewBudgetAllocation, BudgetAllocation, BudgetAllocationUpdate } from '@/src/types/line_items'
import { sql } from 'kysely'

export type BudgetAllocationListItem = BudgetAllocation & {
    entity_name: string | null
    pap_title: string | null
    item_name: string
    fund_description: string | null
}

export type BudgetAllocationRecord = BudgetAllocationListItem

export async function createBudgetAllocation(values: NewBudgetAllocation) {
    return await db
        .insertInto('budget_allocations')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function updateBudgetAllocation(id: string, values: BudgetAllocationUpdate) {
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
