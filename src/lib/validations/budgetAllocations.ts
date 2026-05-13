import { z } from 'zod'

const TierOneRemarkStageSchema = z.enum(['entity_proposal', 'dbm_review', 'dbm_appeal'])
const BulkValidityScopeSchema = z.enum(['all', 'expense_class', 'expense_class_and_tier'])

const optionalEmptyString = z.preprocess(
    (value) => {
        if (typeof value === 'string' && value.trim() === '') return undefined
        return value
    },
    z.string().optional()
)

const numberField = (label: string, min = 0, isInt = false) => z.preprocess(
    (value) => {
        if (typeof value === 'string' && value.trim() === '') return NaN
        return Number(value)
    },
    isInt ? z.int(`${label} must be a whole number`).min(min, `${label} must be at least ${min}`) : z.number().min(min, `${label} must be at least ${min}`),
)

export const TierOneAllocationSchema = z.object({
    entity_id: z.string().uuid('Entity is required.'),
    pap_code: z.string().uuid('PAP is required.'),
    item_catalog_id: z.string().uuid('Item catalog is required.'),
    fund_code: z.string().min(1, 'Fund source is required.'),
    specific_description: optionalEmptyString.nullable().transform((value) => value ?? null),
    currency: z.string().min(1, 'Currency is required.'),
    proposed_amt: numberField('Proposed amount'),
    dbm_rec_amt: numberField('DBM recommended amount'),
    nep_amt: numberField('NEP amount'),
    gaa_amt: numberField('GAA amount'),
    valid_from: optionalEmptyString.nullable().transform((value) => value ?? null),
    valid_until: optionalEmptyString.nullable().transform((value) => value ?? null),
})

export type TierOneAllocationFormState = {
    formErrors?: string[]
    fieldErrors?: Record<string, string[] | undefined>
    values?: Record<string, string | undefined>
} | undefined

export const AllocationRemarkSchema = z.object({
    workflow_stage: TierOneRemarkStageSchema,
    remarks: z.string().trim().min(1, 'Remarks are required.'),
})

export const LegislativeInsertionSchema = z.object({
    entity_id: z.string().uuid('Entity is required.'),
    pap_code: z.string().uuid('PAP is required.'),
    item_catalog_id: z.string().uuid('Item catalog is required.'),
    fund_code: z.string().min(1, 'Fund source is required.'),
    tier: z.preprocess((value) => Number(value), z.union([z.literal(1), z.literal(2)])),
    specific_description: optionalEmptyString.nullable().transform((value) => value ?? null),
    currency: z.string().min(1, 'Currency is required.'),
    gaa_amt: numberField('GAA amount'),
    valid_from: optionalEmptyString.nullable().transform((value) => value ?? null),
    valid_until: optionalEmptyString.nullable().transform((value) => value ?? null),
})

export const BulkValidityUpdateSchema = z.object({
    scope: BulkValidityScopeSchema,
    expense_class: optionalEmptyString,
    tier: z.preprocess(
        (value) => {
            if (typeof value === 'string' && value.trim() === '') return undefined
            return Number(value)
        },
        z.union([z.literal(1), z.literal(2)]).optional()
    ),
    valid_from: optionalEmptyString.nullable().transform((value) => value ?? null),
    valid_until: optionalEmptyString.nullable().transform((value) => value ?? null),
}).superRefine((value, ctx) => {
    if (value.scope !== 'all' && !value.expense_class) {
        ctx.addIssue({
            code: 'custom',
            path: ['expense_class'],
            message: 'Expense class is required for this scope.',
        })
    }

    if (value.scope === 'expense_class_and_tier' && !value.tier) {
        ctx.addIssue({
            code: 'custom',
            path: ['tier'],
            message: 'Tier is required for this scope.',
        })
    }
})

export type AllocationRemarkFormState = {
    formErrors?: string[]
    fieldErrors?: Record<string, string[] | undefined>
    values?: Record<string, string | undefined>
} | undefined
