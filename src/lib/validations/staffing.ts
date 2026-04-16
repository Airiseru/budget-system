import * as z from 'zod'

export const CompensationSchema = z.object({
    name: z.string(),
    amount: z.coerce.number()
})

export const PositionSchema = z.object({
    tier: z.coerce.number(),
    pap_id: z.string(),
    staff_type: z.string(),
    salary_grade: z.string(),
    
    total_salary: z.coerce.number(), 
    
    num_positions: z.coerce.number(),
    position_title: z.string(),
    months_employed: z.coerce.number(),
    organizational_unit: z.string(),
    
    compensations: z.array(CompensationSchema).default([]),
})

export const StaffingSummarySchema = z.object({
    fiscal_year: z.coerce.number(),
    positions: z.array(PositionSchema).default([]),
})