import { z } from 'zod'

export const UacsCategorySchema = z.enum(['funding_source', 'location', 'object_code'])

export const FundingSourceScopeSchema = z.enum(['record', 'cluster', 'financing', 'auth'])
export const LocationScopeSchema = z.enum(['record', 'region', 'province', 'city_municipality'])
export const ObjectCodeScopeSchema = z.enum(['record', 'chart_account'])

export const FundingSourceSchema = z.object({
    description: z.string().min(1, 'Description is required'),
    cluster_code: z.string().regex(/^\d{2}$/, 'Cluster code must be 2 digits'),
    cluster_desc: z.string().optional(),
    financing_code: z.string().regex(/^\d{1}$/, 'Financing code must be 1 digit'),
    financing_desc: z.string().optional(),
    auth_code: z.string().regex(/^\d{2}$/, 'Authorization code must be 2 digits'),
    auth_desc: z.string().optional(),
    category_code: z.string().regex(/^\d{3}$/, 'Category code must be 3 digits'),
    category_desc: z.string().optional(),
    status: z.enum(['active', 'inactive']).default('active'),
})

export const LocationSchema = z.object({
    description: z.string().min(1, 'Description is required'),
    region_code: z.string().regex(/^\d{2}$/, 'Region code must be 2 digits'),
    region_desc: z.string().optional(),
    province_code: z.string().regex(/^\d{2}$/, 'Province code must be 2 digits'),
    province_desc: z.string().optional(),
    city_municipality_code: z.string().regex(/^\d{2}$/, 'City / Municipality code must be 2 digits'),
    city_municipality_desc: z.string().optional(),
    brgy_code: z.string().regex(/^\d{3}$/, 'Barangay code must be 3 digits'),
    brgy_desc: z.string().optional(),
    status: z.enum(['active', 'inactive']).default('active'),
})

export const ObjectCodeSchema = z.object({
    description: z.string().min(1, 'Description is required'),
    chart_account_code: z.string().regex(/^\d{8}$/, 'Chart of accounts code must be 8 digits'),
    chart_account_desc: z.string().optional(),
    sub_object_code: z.string().regex(/^\d{2}$/, 'Sub-object code must be 2 digits'),
    sub_object_desc: z.string().optional(),
    status: z.enum(['active', 'inactive']).default('active'),
})

export type UacsFormState = {
    formErrors?: string[]
    fieldErrors?: Record<string, string[] | undefined>
    values?: Record<string, string | undefined>
} | undefined
