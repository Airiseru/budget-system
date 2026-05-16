import { z } from "zod";

const ExpenseRowSchema = z
    .object({
        expense_class: z.enum(["PS", "MOOE", "CO", "FINEX"]),
        amount: z.coerce.number().min(0, "Amount must be at least 0"),
        currency: z.string().default("PHP"),
        fund_category: z.enum(["LP", "Grant", "GOP"]).nullable().optional(),
        fund_method: z
            .enum(["cash", "non_cash", "non-cash", "imprest", "direct_payment"])
            .nullable()
            .optional()
            .transform((value) => (value === "non-cash" ? "non_cash" : value)),
    })
    .transform(({ fund_category, fund_method, ...cost }) => ({
        ...cost,
        ...(fund_category ? { fund_category } : {}),
        ...(fund_method ? { fund_method } : {}),
    }));

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
    total_proposal_cost: z.coerce.number(),
    pap_prerequisites: z
        .array(
            z.object({
                name: z.string().min(1, "Prerequisite name is required"),
                type: z.string().min(1, "Prerequisite type is required"),
                status: z.string().min(1, "Prerequisite status is required"),
                remarks: z.string().nullable().optional(),
            }),
        )
        .default([]),
    cost_by_components: z
        .array(
            z.object({
                component_name: z.string().optional(),
                item_catalog_id: z.string().min(1, "Item catalog is required"),
                fund_code: z.string().min(1, "Fund source is required"),
                specific_description: z.string().nullable().optional(),
                currency: z.string().min(1, "Currency is required"),
                proposed_amt: z.coerce
                    .number()
                    .min(0.01, "Proposed amount must be greater than 0"),
                tier: z.literal(2).optional().default(2),
                costs: NonZeroCostArraySchema,
            }),
        )
        .min(1, "Please add at least one component allocation"),
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
            ),
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
    }).superRefine((data, ctx) => {
        if (
            data.is_infrastructure &&
            data.local_infrastructure_requirements.length < 1
        ) {
            ctx.addIssue({
                code: "custom",
                path: ["local_infrastructure_requirements"],
                message: "Please add at least one infrastructure requirement",
            })
        }
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

export type ProposalPayload = z.infer<typeof ProposalSchema>;

function sortByStableString<T>(
    items: T[],
    getValue: (item: T) => string | number | null | undefined,
) {
    return [...items].sort((left, right) =>
        String(getValue(left) ?? "").localeCompare(
            String(getValue(right) ?? ""),
            undefined,
            { numeric: true, sensitivity: "base" },
        ),
    );
}

function sortCosts<T extends { expense_class: string }>(costs: T[]) {
    const expenseOrder = new Map([
        ["PS", 0],
        ["MOOE", 1],
        ["CO", 2],
        ["FINEX", 3],
    ]);

    return [...costs].sort((left, right) => {
        const leftRank = expenseOrder.get(left.expense_class) ?? 99;
        const rightRank = expenseOrder.get(right.expense_class) ?? 99;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left.expense_class.localeCompare(right.expense_class);
    });
}

export function normalizeProposalPayload(payload: unknown): ProposalPayload {
    const parsed = ProposalSchema.parse(payload);

    const normalizedBase = {
        ...parsed,
        pap_prerequisites: sortByStableString(
            parsed.pap_prerequisites,
            (prerequisite) =>
                `${prerequisite.type}|${prerequisite.name}|${prerequisite.status}`,
        ),
        cost_by_components: sortByStableString(
            parsed.cost_by_components.map((component) => ({
                ...component,
                costs: sortCosts(component.costs),
            })),
            (component) =>
                `${component.component_name ?? ""}|${component.item_catalog_id}|${component.fund_code}`,
        ),
    };

    if (normalizedBase.type === "202") {
        return {
            ...normalizedBase,
            local_locations: sortByStableString(
                normalizedBase.local_locations.map((location) => ({
                    ...location,
                    costs: sortCosts(location.costs),
                })),
                (location) => location.location,
            ),
            local_financial_attributions: sortByStableString(
                normalizedBase.local_financial_attributions.map(
                    (attribution) => ({
                        ...attribution,
                        attribution_costs: sortByStableString(
                            attribution.attribution_costs
                                .map((attributionCost) => ({
                                    ...attributionCost,
                                    costs: sortCosts(attributionCost.costs),
                                }))
                                .filter(
                                    (attributionCost) =>
                                        attributionCost.costs.length > 0,
                                ),
                            (attributionCost) =>
                                `${attributionCost.year}|${attributionCost.tier}`,
                        ),
                    }),
                ),
                (attribution) => attribution.description,
            ),
            local_infrastructure_requirements: sortByStableString(
                normalizedBase.local_infrastructure_requirements.map(
                    (requirement) => ({
                        ...requirement,
                        costs: sortCosts(requirement.costs),
                    }),
                ),
                (requirement) =>
                    `${requirement.description}|${requirement.year}`,
            ),
            local_physical_targets: sortByStableString(
                normalizedBase.local_physical_targets,
                (target) => `${target.year}|${target.target_description}`,
            ),
        };
    }

    return {
        ...normalizedBase,
        foreign_financial_targets: sortByStableString(
            normalizedBase.foreign_financial_targets.map((target) => ({
                ...target,
                year: Number(target.year),
                lp_imprest: Number(target.lp_imprest),
                lp_direct: Number(target.lp_direct),
                grant: Number(target.grant),
                gop: Number(target.gop),
            })),
            (target) => target.year,
        ),
        foreign_physical_targets: sortByStableString(
            normalizedBase.foreign_physical_targets.map((target) => ({
                ...target,
                costs: sortCosts(target.costs),
            })),
            (target) => target.name,
        ),
    };
}
