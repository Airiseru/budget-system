import { Generated, ColumnType, Selectable, Insertable, Updateable } from 'kysely'

export interface RetireesListTable {
    id: Generated<string>
    is_mandatory: boolean
    submission_date: Generated<Date>
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export interface RetireeRecordTable {
    id: Generated<string>
    retirees_list_id: string // Foreign Key to RetireesListTable
    name: string
    is_gsis_member: boolean
    retirement_law: string // e.g., RA 8291, RA 1616
    position: string
    salary_grade: number
    step: number
    date_of_birth: Date
    original_appointment: Date
    retirement_effectivity: Date
    highest_monthly_salary: number
    // Leave Credits for Terminal Leave Pay (TLP) calculation
    number_vacation_leave: number | null
    number_sick_leave: number | null
    tlb_constant_factor: number
    tlb_amount: number
    total_credible_service: number | null
    number_gratuity_months: number | null
    rg_amount: number | null
}

export type RetireesList = Selectable<RetireesListTable>
export type NewRetireesList = Insertable<RetireesListTable>
export type RetireeRecord = Selectable<RetireeRecordTable>
export type NewRetireeRecord = Insertable<RetireeRecordTable>