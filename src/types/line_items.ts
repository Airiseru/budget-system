import {
    Generated,
    ColumnType,
    Insertable,
    Selectable,
    Updateable
} from 'kysely'

import { EXPENSE_CLASSES } from '../lib/constants'

export interface ItemCatalogTable {
    id: Generated<string>
    expense_class: typeof EXPENSE_CLASSES[number]
    uacs_obj_code: string
    prexc_fpap_id: string
    scope: 'global' | 'entity' | 'pap'
    entity_id: string | null
    pap_code: string | null
    name: string
    description: string | null
    unit_of_measure: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type ItemCatalog = Selectable<ItemCatalogTable>
export type NewItemCatalog = Insertable<ItemCatalogTable>
export type ItemCatalogUpdate = Updateable<ItemCatalogTable>

export interface BudgetAllocationTable {
    id: Generated<string>
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
    valid_from: Date
    valid_until: Date
    auth_status: 'draft' | 'proposed' | 'dbm_approved' | 'gaa_approved' | 'rejected'
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type BudgetAllocation = Selectable<BudgetAllocationTable>
export type NewBudgetAllocation = Insertable<BudgetAllocationTable>
export type BudgetAllocationUpdate = Updateable<BudgetAllocationTable>