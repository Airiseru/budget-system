import { z } from "zod";

export const compensationSchema = z.object({
    name: z.string().min(1, "Benefit name is required"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    compensation_rule_id: z.string().nullable(),
});

export const positionSchema = z.object({
    pap_id: z.string().min(1, "Please select a PAP"),
    tier: z.number().min(1, "Tier is required").max(2),
    position_title: z.string().min(1, "Position title is required"),
    staff_type: z.string().min(1, "Staff type is required"),
    organizational_unit: z.string().min(1, "Org unit is required"),
    salary_schedule_id: z.string().min(1, "Salary schedule is required"),
    salary_grade: z.number().min(1, "Salary grade is required").max(33, "Salary grade must be between 1 and 33"),
    step: z.number().min(1, "Step is required").max(8, "Step must be between 1 and 8"),
    monthly_base_salary: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    total_salary: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    num_positions: z.number().min(1, "Qty must be at least 1"),
    months_employed: z.number().min(1).max(12),
    compensations: z.array(compensationSchema),
});

export const staffingFormSchema = z.object({
    fiscal_year: z.coerce.number().min(2020).max(2100),
    positions: z.array(positionSchema).min(1, "At least one position is required"),
});