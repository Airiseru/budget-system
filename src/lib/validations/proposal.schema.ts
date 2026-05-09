import { z } from "zod";

const ExpenseRowSchema = z.object({
    expense_class: z.enum(["PS", "MOOE", "CO", "FINEX"]),
    amount: z.coerce.number().min(0, "Amount must be at least 0"),
    currency: z.string().default("PHP"),
});

const NonZeroCostArraySchema = z
    .array(ExpenseRowSchema)
    .min(1, "At least one cost row is required")
    .refine((costs) => costs.some((item) => item.amount > 0), {
        message: "At least one expense item must have an amount greater than 0",
    });

const BaseSchema = z.object({
    title: z.string().min(5, "Title must be at least 5 characters"),
    proposal_year: z
        .number()
        .min(1987, "The Fifth Philippine Republic began at 1987"),
    priority_rank: z.number().int().positive("Rank must be a positive number"),
    org_outcome_id: z.string().min(1, "Organizational Outcome is required"),
    description: z.string().min(1, "Description is too short"),
    purpose: z.string().min(1, "Purpose is too short"),
    beneficiaries: z.string().min(1, "Beneficiaries field is required"),
    is_new: z.boolean(),
    is_infrastructure: z.boolean(),
    myca_issuance: z.boolean().nullable().optional(),
    for_ict: z.boolean().nullable().optional(),
    total_proposal_currency: z.string().default("PHP"),
    total_proposal_cost: z.union([z.number(), z.string()]),
    cost_by_components: z
        .array(
            z.object({
                component_name: z.string().min(1, "Component name is required"),
                costs: NonZeroCostArraySchema,
            }),
        )
        .min(1, "Please add at least one component"),
});

export const ProposalSchema = z.discriminatedUnion("type", [
    BaseSchema.extend({
        type: z.literal("202"),
        local_locations: z
            .array(
                z.object({
                    location: z.string().min(1, "Location name required"),
                    costs: NonZeroCostArraySchema,
                }),
            )
            .min(1, "Please add at least one location"),
        local_financial_attributions: z
            .array(
                z.object({
                    description: z.string().min(1, "Description required"),
                    attribution_costs: z
                        .array(
                            z.object({
                                year: z.number(),
                                tier: z.number().min(1).max(2),
                                costs: z.array(ExpenseRowSchema),
                            }),
                        )
                        .min(
                            1,
                            "At least one year/tier attribution is required",
                        ),
                }),
            )
            .min(1, "Please add at least one financial attribution")
            .refine(
                (attributions) =>
                    attributions.some((attr) =>
                        attr.attribution_costs.some(
                            (ac) =>
                                ac.costs.length > 0 &&
                                ac.costs.some((c) => c.amount > 0),
                        ),
                    ),
                {
                    message:
                        "At least one expense cost with a non-zero amount must be provided across all attributions.",
                },
            ),
        local_infrastructure_requirements: z
            .array(
                z.object({
                    description: z.string().min(1, "Description required"),
                    year: z.number(),
                    total_amt: z.coerce.number().min(0),
                    costs: NonZeroCostArraySchema,
                }),
            )
            .min(1, "Please add at least one infrastructure requirement"),
        local_physical_targets: z
            .array(
                z.object({
                    year: z.number(),
                    target_description: z
                        .string()
                        .min(1, "Target description required"),
                }),
            )
            .min(1, "Please add at least one physical target"),
    }),

    // --- FORM 203 ---
    BaseSchema.extend({
        type: z.literal("203"),
        foreign_financial_targets: z
            .array(
                z.object({
                    year: z.number(),
                    lp_imprest: z.coerce.number().min(0),
                    lp_direct: z.coerce.number().min(0),
                    grant: z.coerce.number().min(0),
                    gop: z.coerce.number().min(0),
                }),
            )
            .min(1, "Please add at least one foreign financial target"),
        foreign_physical_targets: z
            .array(
                z.object({
                    name: z.string().min(1, "Target name required"),
                    costs: NonZeroCostArraySchema,
                }),
            )
            .min(1, "Please add at least one foreign physical target"),
    }),
]);
