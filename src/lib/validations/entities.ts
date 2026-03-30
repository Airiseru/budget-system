import { z } from 'zod'
import { AgencyTypes } from '@/src/types/entities'

export const DepartmentSchema = z.object({
    name: z.string().min(1, { error: "Name is required" }),
    uacs_code: z.coerce.number().min(1, { error: "UACS Code is required" }).max(99, { error: "UACS Code must be between 1 and 99" }),
    abbr: z.string().min(1, { error: "Abbreviation is required" }),
})

export const AgencySchema = z.object({
    name: z.string().min(1, { error: "Name is required" }),
    uacs_code: z.coerce.number().min(0, { error: "UACS Code is required" }).max(999, { error: "UACS Code must be between 1 and 999" }),
    type: z.enum(AgencyTypes).default('bureau'),
    department_id: z.string().nullable().optional(),
})

export const OperatingUnitSchema = z.object({
    name: z.string().min(1, { error: "Name is required" }),
    uacs_code: z.coerce.number().min(1, { error: "UACS Code is required" }).max(99, { error: "UACS Code must be between 1 and 99" }),
    agency_id: z.string().min(1, { error: "Agency is required" })
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
    }
    values?: {
        name?: string
        abbr?: string
        uacs_code?: string
        type?: string
        department_id?: string
        agency_id?: string
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