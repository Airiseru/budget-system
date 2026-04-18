import { z } from 'zod';

export const RetireeRowSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Full Name is required"),
    is_gsis_member: z.boolean(),
    retirement_law: z.string(),
    position: z.string().min(1, "Position is required"),
    salary_grade: z.coerce.number().min(1).max(33),
    date_of_birth: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Birth Date"),
    original_appointment: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Appointment Date"),
    retirement_effectivity: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Effectivity Date"),
    highest_monthly_salary: z.coerce.number().min(0),
    number_vacation_leave: z.coerce.number().min(0).default(0),
    number_sick_leave: z.coerce.number().min(0).default(0),
    total_credible_service: z.coerce.number().min(0).default(0),
    number_gratuity_months: z.coerce.number().min(0).default(0),
});

// Schema for the entire form submission
export const BP205Schema = z.object({
    retirees: z.array(RetireeRowSchema).min(1, "At least one retiree must be listed"),
    listData: z.object({
        fiscal_year: z.number(),
        is_mandatory: z.boolean(),
    }).optional(),
});