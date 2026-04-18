import * as z from 'zod'

export const RetireesSchema = z.object({
    name: z.string(),
    is_gsis_member: z.boolean(),
    retirement_law: z.string(),
    position: z.string(),
    salary_grade: z.coerce.number().min(1).max(33),
    date_of_birth: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Birth Date"),
    original_appointment: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Appointment Date"),
    retirement_effectivity: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Effectivity Date"),
    highest_monthly_salary: z.coerce.number().min(0),
    number_vacation_leave: z.coerce.number().min(0).default(0),
    number_sick_leave: z.coerce.number().min(0).default(0),
    total_credible_service: z.coerce.number().min(0).default(0),
    number_gratuity_months: z.coerce.number().min(0).default(0),
})

export const RetireesListSchema = z.object({
    fiscal_year: z.coerce.number(),
    is_mandatory: z.boolean(),
    retirees: z.array(RetireesSchema).min(1, "At least one retiree must be listed"),
})