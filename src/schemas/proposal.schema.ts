import { z } from "zod";

export const ExpenseRowSchema = z.object({
    expense_class: z.enum(["PS", "MOOE", "CO", "FINEX"]),
    amount: z.coerce.number().min(0, "Amount must be at least 0"),
    currency: z.string().default("PHP"),
});

export const ProposalSchema = z.object({
    // Summary Data Fields
    title: z.string().min(5, "Title must be at least 5 characters"),
    proposal_year: z
        .number()
        .min(1987, "The Fifth Philippine Republic began at 1987"),
    priority_rank: z.number().min(1, "Rank cannot be below 1"),

    // PAP Specific Fields (Mandatory for your DB)
    org_outcome_id: z.string().min(1, "Organizational Outcome is required"),
    description: z.string().min(1, "Description is too short"),
    purpose: z.string().min(1, "Purpose is too short"),
    beneficiaries: z.string().min(1, "Beneficiaries field is required"),

    // Payload Fields
    is_new: z.boolean(),
    is_infrastructure: z.boolean(),
    cost_by_components: z
        .array(
            z.object({
                component_name: z.string().min(1, "Component name is required"),
                costs: z
                    .array(ExpenseRowSchema)
                    .min(1, "At least one cost required per component"),
            }),
        )
        .min(1, "Please add at least one component"),

    // Optional: Add validation for locations if it's Form 202
    local_locations: z
        .array(
            z.object({
                location: z.string().min(1, "Location name required"),
                costs: z.array(ExpenseRowSchema),
            }),
        )
        .optional(),
});
