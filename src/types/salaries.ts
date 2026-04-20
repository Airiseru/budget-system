import {
    Generated,
    Insertable, 
    Selectable,
} from 'kysely'

export interface SalarySchedulesTable {
    id: Generated<string>
    circular_reference: string
    effective_date: Date
    created_at: Generated<Date>
}

export type SalarySchedule = Selectable<SalarySchedulesTable>
export type NewSalarySchedule = Insertable<SalarySchedulesTable>

export interface SalaryRatesTable {
    id: Generated<string>
    schedule_id: string
    salary_grade: number
    step: number
    amount: number
}

export interface AllSalaryRates extends SalarySchedule {
    rates: Omit<SalaryRatesTable, 'id' | 'schedule_id'>[]
}

export type SalaryRate = Selectable<SalaryRatesTable>
export type NewSalaryRate = Insertable<SalaryRatesTable>

export interface CompensationRulesTable {
    id: Generated<string>
    name: string
    effective_date: Date
    calculation_type: string
    rule_value: Number
    frequency: string
    min_salary_grade: Number
    max_salary_grade: Number
    created_at: Generated<Date>
}

export type CompensationRule = Selectable<CompensationRulesTable>
export type NewCompensationRule = Insertable<CompensationRulesTable>