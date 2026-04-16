import { z } from "zod";

export const compensationSchema = z.object({
  name: z.string().min(1, "Benefit name is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
});

export const positionSchema = z.object({
  pap_id: z.string().min(1, "Please select a PAP"),
  position_title: z.string().min(1, "Position title is required"),
  staff_type: z.string().min(1, "Staff type is required"),
  organizational_unit: z.string().min(1, "Org unit is required"),
  salary_grade: z.string().min(1, "Salary grade is required"),
  total_salary: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  num_positions: z.number().min(1, "Qty must be at least 1"),
  months_employed: z.number().min(1).max(12),
  compensations: z.array(compensationSchema),
});

export const staffingFormSchema = z.object({
  fiscal_year: z.coerce.number().min(2020).max(2100),
  positions: z.array(positionSchema).min(1, "At least one position is required"),
});