import { z } from 'zod'

export const ItemCatalogSchema = z.object({
    scope: z.enum(['global', 'entity', 'pap']),
    entity_id: z.string().uuid().optional().nullable(),
    pap_code: z.string().uuid().optional().nullable(),
    uacs_obj_code: z.string().min(1, 'Object code is required'),
    name: z.string().min(1, 'Item name is required'),
    description: z.string().optional().nullable(),
    expense_class: z.enum(['PS', 'MOOE', 'CO', 'FINEX']),
    expense_class_code: z.enum(['1', '2', '3', '6']),
    unit_of_measure: z.string().optional().nullable(),
})

export const ItemCatalogObjectCodeSchema = z.object({
    description: z.string().min(1, 'Object code description is required'),
    chart_account_code: z.string().regex(/^\d{8}$/, 'Chart of accounts code must be 8 digits'),
    chart_account_desc: z.string().optional().nullable(),
    sub_object_code: z.string().regex(/^\d{2}$/, 'Sub-object code must be 2 digits'),
    sub_object_desc: z.string().optional().nullable(),
    status: z.enum(['active', 'inactive']).default('active'),
})

export type ItemFormState = {
    formErrors?: string[]
    fieldErrors?: Record<string, string[] | undefined>
    values?: Record<string, string | undefined>
} | undefined
