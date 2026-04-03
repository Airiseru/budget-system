import {
    Generated,
    ColumnType,
    Insertable,
    Selectable,
    Updateable
} from 'kysely'

export interface StaffingTable {
    id: Generated<string>
    // Link to the base 'form' table (the envelope)
    form_id: string 
    fiscal_year: number
    digital_signature: string
    submission_date: Generated<Date>
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type StaffingSummary = Selectable<StaffingTable>
export type NewStaffingSummary = Insertable<StaffingTable>
export type StaffingSummaryUpdate = Updateable<StaffingTable>

export interface PositionTable {
    id: Generated<string>
    // Link to the specific 'staffing_summary' (the document)
    staffing_summary_id: string 
    pap_id: string
    tier: number
    staff_type: string
    organizational_unit: string
    position_title: string
    salary_grade: string
    num_positions: number
    months_employed: number
    total_salary: number
}

export type Position = Selectable<PositionTable>
export type NewPosition = Insertable<PositionTable>
export type PositionUpdate = Updateable<PositionTable>