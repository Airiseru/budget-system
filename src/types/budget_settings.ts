import {
    Generated,
    ColumnType,
    Insertable,
    Selectable,
    Updateable
} from 'kysely'

export type BudgetCyclePrepStatus = 'closed' | 'active' | 'locked'
export type BudgetCyclePhase =
    | 'preparation'
    | 'dbm_review'
    | 'presidential_approval'
    | 'legislative_deliberation'
    | 'enacted_gaa'

export interface BudgetCycleTable {
    fiscal_year: number
    prep_status: BudgetCyclePrepStatus
    current_phase: BudgetCyclePhase
    prep_opened_at: Date | null
    prep_locked_at: Date | null
    status_changed_by: string | null
    legal_basis_ref: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type BudgetCycle = Selectable<BudgetCycleTable>
export type NewBudgetCycle = Insertable<BudgetCycleTable>
export type BudgetCycleUpdate = Updateable<BudgetCycleTable>
