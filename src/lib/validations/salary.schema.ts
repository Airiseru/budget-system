import { z } from 'zod'
import { MAX_SG, MAX_STEP } from '../constants'

export const SalaryRateSchema = z.object({
    salary_grade: z.coerce.number().min(1, 'Salary grade is required').max(MAX_SG, `Salary grade must be between 1 and ${MAX_SG}`),
    step: z.coerce.number().min(1, 'Step is required').max(MAX_STEP),
    amount: z.coerce.number().min(0, 'Amount must be greater than 0'),
})
 
export const SalaryScheduleSchema = z.object({
    circular_reference: z.string().min(1, 'Circular reference is required'),
    effective_date: z.coerce.date({ error: 'Effective date is required' }),
    rates: z.array(SalaryRateSchema).min(1, 'At least one rate is required'),
})
 
export type SalaryScheduleState = {
    fieldErrors?: {
        circular_reference?: string[]
        effective_date?: string[]
        rates?: string[]
    }
    formErrors?: string[]
    values?: {
        circular_reference?: string
        effective_date?: string
    }
    success?: boolean
} | undefined