import { z } from 'zod'
import { MAX_SG, VALID_COMPENSATION_NAMES } from '../constants'
 
export const CompensationRuleSchema = z.object({
    name: z.enum(VALID_COMPENSATION_NAMES, { error: 'Compensation name is required' }),
    effective_date: z.coerce.date({ error: 'Effective date is required' }),
    calculation_type: z.enum(['fixed', 'percentage', 'salary_multiplier', 'value_multiplier'], { error: 'Calculation type is required' }),
    frequency: z.enum(['monthly', 'annual'], { error: 'Frequency is required' }),
    rule_value: z.coerce.number().min(0, 'Value must be positive'),
    min_salary_grade: z.coerce.number().min(1).max(MAX_SG).default(1),
    max_salary_grade: z.coerce.number().min(1).max(MAX_SG).default(MAX_SG),
})
 
export type CompensationRuleState = {
    fieldErrors?: {
        name?: string[]
        effective_date?: string[]
        calculation_type?: string[]
        frequency?: string[]
        rule_value?: string[]
        min_salary_grade?: string[]
        max_salary_grade?: string[]
    }
    formErrors?: string[]
    values?: Record<string, string>
    success?: boolean
} | undefined