import { z } from 'zod'

export const StartBudgetCycleSchema = z.object({
    fiscal_year: z.coerce.number().int().min(2000).max(9999),
    legal_basis_ref: z.string().trim().max(255).optional(),
})

export const EditBudgetCycleSchema = z.object({
    fiscal_year: z.coerce.number().int().min(2000).max(9999),
    prep_status: z.enum(['closed', 'active', 'locked']),
    legal_basis_ref: z.string().trim().max(255).optional(),
})

export type BudgetCycleFormState = {
    formErrors?: string[]
    fieldErrors?: {
        fiscal_year?: string[]
        prep_status?: string[]
        legal_basis_ref?: string[]
    }
    values?: Record<string, string | undefined>
} | undefined
