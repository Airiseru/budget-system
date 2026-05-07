import {
    Generated,
    ColumnType,
    Insertable,
    Selectable,
    Updateable
} from 'kysely'
import type { BUDGET_PREP_WORKFLOW_STAGES_TYPE } from '../lib/constants'

export type ItemCatalogScope = 'global' | 'entity' | 'pap'
export type ExpenseClassCode = '1' | '2' | '3' | '6'
export type ExpenseClass = 'PS' | 'MOOE' | 'CO' | 'FINEX'

export interface ItemCatalogTable {
    id: Generated<string>
    uacs_obj_code: string
    scope: ItemCatalogScope
    entity_id: string | null
    pap_code: string | null
    name: string
    description: string | null
    expense_class: ExpenseClass
    expense_class_code: ExpenseClassCode
    unit_of_measure: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type ItemCatalog = Selectable<ItemCatalogTable>
export type NewItemCatalog = Insertable<ItemCatalogTable>
export type ItemCatalogUpdate = Updateable<ItemCatalogTable>

export interface BudgetAllocationTable {
    id: Generated<string>
    entity_id: string
    budget_cycle_year: number
    pap_code: string | null
    fund_code: string | null
    item_catalog_id: string
    tier: 1 | 2
    specific_description: string | null
    quantity: number
    currency: string
    proposed_amt: number
    dbm_rec_amt: number
    nep_amt: number
    gaa_amt: number
    valid_from: Date | null
    valid_until: Date | null
    auth_status: 'draft' | 'proposed' | 'dbm_approved' | 'gaa_approved' | 'rejected'
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type BudgetAllocation = Selectable<BudgetAllocationTable>
export type NewBudgetAllocation = Insertable<BudgetAllocationTable>
export type BudgetAllocationUpdate = Updateable<BudgetAllocationTable>

export interface AllocationWorkflowLogTable {
    id: Generated<string>
    allocation_id: string
    workflow_stage: BUDGET_PREP_WORKFLOW_STAGES_TYPE
    remarks: string
    amt_before: number | null
    amt_after: number | null
    performed_by: string
    created_at: Generated<Date>
}

export type AllocationWorkflowLog = Selectable<AllocationWorkflowLogTable>
export type NewAllocationWorkflowLog = Insertable<AllocationWorkflowLogTable>
export type AllocationWorkflowLogUpdate = Updateable<AllocationWorkflowLogTable>
