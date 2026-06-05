import { z } from 'zod'
import { AgencyTypes } from '@/src/types/entities'

export const DepartmentSchema = z.object({
    name: z.string().min(1, { error: "Name is required" }).max(128, { error: "Name must be less than 128 characters" }),
    uacs_code: z.string().regex(/^\d{2}$/, { error: "Department UACS Code must be exactly 2 digits" }),
    abbr: z.string().min(1, { error: "Abbreviation is required" }).max(16, { error: "Abbreviation must be less than 16 characters" })
})

export const AgencySchema = z.object({
    name: z.string().min(1, { error: "Name is required" }).max(128, { error: "Name must be less than 128 characters" }),
    abbr: z.string().max(16, { error: "Abbreviation must be less than 16 characters" }).nullable().optional(),
    uacs_code: z.string().regex(/^\d{3}$/, { error: "Agency UACS Code must be exactly 3 digits" }),
    type: z.enum(AgencyTypes).default('bureau'),
    department_id: z.string().nullable().optional(),
})

export const OperatingUnitSchema = z.object({
    name: z.string().min(1, { error: "Name is required" }).max(256, { error: "Name must be less than 256 characters" }),
    abbr: z.string().max(16, { error: "Abbreviation must be less than 16 characters" }).nullable().optional(),
    uacs_code: z.string().min(1, { error: "UACS Code is required" }),
    agency_id: z.string().min(1, { error: "Agency is required" }),
    parent_ou_id: z.string().nullable().optional(),
}).superRefine((data, ctx) => {
    const isLowerLevelOu = !!data.parent_ou_id

    if (isLowerLevelOu) {
        if (!/^\d{5}$/.test(data.uacs_code)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['uacs_code'],
                message: 'Lower-level operating unit UACS Code must be exactly 5 digits',
            })
        }
        return
    }

    if (!/^\d{2}$/.test(data.uacs_code)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['uacs_code'],
            message: 'Operating unit UACS Code must be exactly 2 digits',
        })
    }
})

export type NewEntityFormState = {
    formErrors?: string[]
    fieldErrors?: {
        name?: string[]
        abbr?: string[]
        uacs_code?: string[]
        type?: string[]
        department_id?: string[]
        agency_id?: string[]
        parent_ou_id?: string[]
    }
    values?: {
        name?: string
        abbr?: string
        uacs_code?: string
        type?: string
        department_id?: string
        agency_id?: string
        parent_ou_id?: string
    }
} | undefined

export type EditEntityFormState = {
    formErrors?: string[]
    fieldErrors?: {
        entity_id?: string[]
        entity_type?: string[]
        name?: string[]
        abbr?: string[]
        uacs_code?: string[]
        type?: string[]
        department_id?: string[]
        agency_id?: string[]
        parent_ou_id?: string[]
    }
    values?: {
        entity_id?: string
        entity_type?: string
        name?: string
        abbr?: string | null
        uacs_code?: string
        type?: string
        department_id?: string
        agency_id?: string
        parent_ou_id?: string
    }
} | undefined

export type DeleteEntityFormState = {
    formErrors?: string[]
    fieldErrors?: {
        entity_id?: string[]
        entity_type?: string[]
    }
    values?: {
        entity_id?: string
        entity_type?: string
    }
} | undefined
