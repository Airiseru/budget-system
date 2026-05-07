import { z } from 'zod'

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
    quantity: numberField('Quantity', 1, true),
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
