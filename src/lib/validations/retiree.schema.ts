import { z } from 'zod';

export const RetireeRowSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Full Name is required"),
    is_gsis_member: z.boolean(),
    retirement_law: z.string(),
    position: z.string().min(1, "Position is required"),
    salary_grade: z.coerce.number().min(1).max(33),
    date_of_birth: z.coerce.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Birth Date"),
    original_appointment: z.coerce.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Appointment Date"),
    retirement_effectivity: z.coerce.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Effectivity Date"),
    highest_monthly_salary: z.coerce.number().min(0.01, "Highest monthly salary must be greater than 0"),
    number_vacation_leave: z.coerce.number().min(0, "Amount must be greater than 0").default(0),
    number_sick_leave: z.coerce.number().min(0, "Amount must be greater than 0").default(0),
    total_credible_service: z.coerce.number().min(0, "Amount must be greater than 0").default(0),
    number_gratuity_months: z.coerce.number().min(0, "Amount must be greater than 0").default(0),
    rg_amount: z.coerce.number().min(0, "Amount must be greater than 0").default(0),
});

// Schema for the entire form submission
export const BP205Schema = z.object({
    retirees: z.array(RetireeRowSchema).min(1, "At least one retiree must be listed"),
    listData: z.object({
        fiscal_year: z.number(),
        is_mandatory: z.boolean(),
    }).optional(),
})

// Used for form extraction in audits
export const RetireesSchema = z.object({
    name: z.string().min(1, 'Full Name is required'),
    is_gsis_member: z.boolean(),
    retirement_law: z.string(),
    position: z.string().min(1, 'Position is required'),
    salary_grade: z.coerce.number().min(1).max(33),
    date_of_birth: z.coerce.date().or(z.any().transform(v => new Date(String(v)))),
    original_appointment: z.coerce.date().or(z.any().transform(v => new Date(String(v)))),
    retirement_effectivity: z.coerce.date().or(z.any().transform(v => new Date(String(v)))),
    highest_monthly_salary: z.coerce.number().min(0.01),
    number_vacation_leave: z.coerce.number().min(0).default(0),
    number_sick_leave: z.coerce.number().min(0).default(0),
    tlb_amount: z.coerce.number().min(0).default(0),
    total_credible_service: z.coerce.number().min(0).default(0),
    number_gratuity_months: z.coerce.number().min(0).default(0),
    rg_amount: z.coerce.number().min(0).default(0),
})

export const retireeFormSchema = z.object({
    fiscal_year: z.coerce.number(),
    is_mandatory: z.boolean(),
    retirees: z.array(RetireesSchema).min(1, "At least one retiree must be listed"),
})