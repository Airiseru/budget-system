"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProposalSchema } from "@/src/schemas/proposal.schema";

const DEFAULT_PREREQUISITES = [
    // Approving Authorities
    {
        name: "ED Council",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "DEPDev - ICC",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "DPWH - Approved Master Plan",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "DPWH Certification",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "DPWH MOA",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "DPWH Costing",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "DENR Clearance",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "MITHI Steering Committee",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "RDC-Endorsed",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "CSO Consultation",
        type: "authority",
        status: "Not Applicable",
        remarks: "",
    },

    // Supporting Documents
    {
        name: "List of Locations",
        type: "document",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "List of Beneficiaries",
        type: "document",
        status: "Not Applicable",
        remarks: "",
    },
    {
        name: "Feasibility Study",
        type: "document",
        status: "Not Applicable",
        remarks: "",
    },
];

type FinancialTableKey =
    | "cost_by_components"
    | "local_locations"
    | "local_financial_attributions"
    | "local_infrastructure_requirements"
    | "foreign_financial_targets";

interface ExpenseRow {
    expense_class: "PS" | "MOOE" | "CO" | "FE";
    amount: number | string;
    currency: string;
    year?: number;
    tier?: number | null;
}

interface ProjectProposalPayload {
    proposal_year: number;
    priority_rank: number;
    is_new: boolean;
    myca_issuance?: boolean | null;
    is_infrastructure: boolean;
    for_ict?: boolean | null;
    total_proposal_currency: string;
    total_proposal_cost: number | string;
    type: "202" | "203";

    pap_prerequisites: {
        name: string;
        type: string;
        status: string;
        remarks?: string | null;
    }[];

    cost_by_components: { component_name: string; costs: ExpenseRow[] }[];
    local_locations: { location: string; costs: ExpenseRow[] }[];

    local_financial_attributions: {
        description: string;
        year: number;
        tier?: number;
        total_amt: number | string;
        costs: ExpenseRow[];
    }[];
    local_physical_targets: { year: number; target_description: string }[];
    local_infrastructure_requirements: {
        description: string;
        year: number;
        total_amt: number | string;
        costs: ExpenseRow[];
    }[];

    foreign_financial_targets: {
        year: number;
        total_amt: number | string;
        costs: ExpenseRow[];
    }[];
    foreign_physical_targets: { name: string }[];
}

const PrerequisiteRow = ({ pre, index, updateRow }: any) => (
    <tr className="border-b border-muted-100 last:border-0 hover:bg-muted-50/30 transition-colors">
        <td className="py-3 px-4 text-sm text-muted-700 font-medium border-r bg-background">
            <input
                className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-blue-200"
                placeholder="Approver"
                value={pre.name ?? ""}
                onChange={(e) =>
                    updateRow("pap_prerequisites", index, {
                        name: e.target.value,
                    })
                }
            />
        </td>

        {/* YES Column */}
        <td className="py-3 px-2 text-center border-r">
            <input
                type="checkbox"
                className="w-4 h-4 rounded border-muted-300 text-blue-600"
                checked={pre.status === "True"}
                onChange={() =>
                    updateRow("pap_prerequisites", index, {
                        status: "True",
                    })
                }
            />
        </td>

        {/* NO Column */}
        <td className="py-3 px-2 text-center border-r">
            <input
                type="checkbox"
                className="w-4 h-4 rounded border-muted-300 text-red-500"
                checked={pre.status === "False"}
                onChange={() =>
                    updateRow("pap_prerequisites", index, {
                        status: "False",
                    })
                }
            />
        </td>

        {/* N/A Column */}
        <td className="py-3 px-2 text-center">
            <input
                type="checkbox"
                className="w-4 h-4 rounded border-muted-300 text-muted-400"
                checked={pre.status === "Not Applicable"}
                onChange={() =>
                    updateRow("pap_prerequisites", index, {
                        status: "Not Applicable",
                    })
                }
            />
        </td>

        {/* Remarks Column */}
        <td className="py-2 px-4 border-l bg-background">
            <input
                className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-blue-200"
                placeholder="Remarks..."
                value={pre.remarks ?? ""}
                onChange={(e) =>
                    updateRow("pap_prerequisites", index, {
                        remarks: e.target.value,
                    })
                }
            />
        </td>
    </tr>
);

const ExpenseSubForm = ({
    field,
    parentIdx,
    costs,
    updateExpense,
    updateRow,
}: {
    field: any;
    parentIdx: number;
    costs: ExpenseRow[];
    updateRow: Function;
    updateExpense: Function;
}) => {
    // Helper to find or update a specific expense class within the array
    const handleValueChange = (
        targetClass: "PS" | "MOOE" | "CO" | "FE",
        value: string,
    ) => {
        const existingIdx = costs.findIndex(
            (c) => c.expense_class === targetClass,
        );

        if (existingIdx > -1) {
            // Update existing class
            updateExpense(field, parentIdx, existingIdx, { amount: value });
        } else {
            // If class doesn't exist yet, add it to the array via updateRow logic
            const newCosts = [
                ...costs,
                {
                    expense_class: targetClass,
                    amount: value,
                    currency: "PHP",
                },
            ];
            updateRow(field, parentIdx, { costs: newCosts });
        }
    };

    const getAmount = (targetClass: string) =>
        costs.find((c) => c.expense_class === targetClass)?.amount ?? "";

    return (
        <div className="mt-4 pl-4 border-l-2 border-muted-100">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 mb-1">
                {["PS", "MOOE", "CO", "FINEX"].map((h) => (
                    <span
                        key={h}
                        className="text-[9px] font-black text-muted-400 uppercase text-center"
                    >
                        {h}
                    </span>
                ))}
            </div>

            {/* Values Row */}
            <div className="grid grid-cols-4 gap-4">
                {(["PS", "MOOE", "CO", "FE"] as const).map((itemClass) => (
                    <div key={itemClass} className="relative">
                        <input
                            type="number"
                            className="w-full border-b border-muted-100 outline-none text-sm text-right pr-1 focus:border-secondary-foreground-400 focus:bg-secondary-foreground-50/30 transition-all"
                            placeholder="0"
                            value={getAmount(itemClass)}
                            onChange={(e) =>
                                handleValueChange(itemClass, e.target.value)
                            }
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

interface WrapperProps {
    project?: any; // <--- Add this line
    type: "202" | "203";
    userId: string;
    entityName: string;
    entityId: string;
}

export default function ProposalForm({
    project,
    type,
    userId,
    entityName,
    entityId,
}: WrapperProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [submitAction, setSubmitAction] = useState<
        "draft" | "pending_budget"
    >("draft");

    if (project) {
        console.log(project);
    }

    const [summaryData, setSummaryData] = useState({
        title: project?.title || "",
        proposal_year: project?.proposal_year || 2026,
        priority_rank: project?.priority_rank || 1,
        type: type,
        org_outcome_id: project?.org_outcome_id || "",
        description: project?.description || "",
        purpose: project?.purpose || "",
        beneficiaries: project?.beneficiaries || "",
    });

    const [payload, setPayload] = useState<ProjectProposalPayload>({
        // Top-level fields from project or defaults
        proposal_year: project?.proposal_year || 2026,
        priority_rank: project?.priority_rank || 1,
        is_new: project?.is_new ?? false,
        myca_issuance: project?.myca_issuance ?? false,
        is_infrastructure: project?.is_infrastructure ?? false,
        for_ict: project?.for_ict ?? false,
        total_proposal_currency: project?.total_proposal_currency || "PHP",
        total_proposal_cost: project?.total_proposal_cost || 0,
        type: type,

        pap_prerequisites: project?.pap_prerequisites || DEFAULT_PREREQUISITES,
        cost_by_components: project?.cost_by_components || [],

        local_locations:
            project?.local_locations?.length > 0 ? project.local_locations : [],

        local_financial_attributions:
            project?.local_financial_attributions || [],
        local_physical_targets: project?.local_physical_targets || [],
        local_infrastructure_requirements:
            project?.local_infrastructure_requirements || [],
        foreign_financial_targets: project?.foreign_financial_targets || [],
        foreign_physical_targets: project?.foreign_physical_targets || [],
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    console.log(summaryData);
    console.log(payload);

    const addRow = <K extends keyof ProjectProposalPayload>(
        field: K,
        defaultValue: ProjectProposalPayload[K] extends (infer U)[] ? U : never,
    ) => {
        setPayload((prev) => ({
            ...prev,
            [field]: [...(prev[field] as any[]), defaultValue],
        }));
    };

    const updateRow = <K extends keyof ProjectProposalPayload>(
        field: K,
        index: number | null, // null for top-level fields
        value: Partial<ProjectProposalPayload[K]> | ProjectProposalPayload[K],
    ) => {
        setPayload((prev) => {
            // Case 1: Updating a top-level field (is_new, priority_rank, etc.)
            if (index === null) {
                return { ...prev, [field]: value };
            }

            // Case 2: Updating an item inside an array (pap_prerequisites, etc.)
            const currentArray = prev[field];
            if (Array.isArray(currentArray)) {
                const updatedArray = [...currentArray];
                updatedArray[index] =
                    typeof value === "object" && value !== null
                        ? { ...updatedArray[index], ...value }
                        : value;
                return { ...prev, [field]: updatedArray };
            }

            return prev;
        });
    };

    const updateExpense = (
        field: FinancialTableKey,
        parentIdx: number,
        expIdx: number,
        value: Partial<ExpenseRow>,
    ) => {
        setPayload((prev) => {
            const updatedParentArray = [...(prev[field] as any[])];
            const updatedCosts = [...updatedParentArray[parentIdx].costs];

            updatedCosts[expIdx] = { ...updatedCosts[expIdx], ...value };
            updatedParentArray[parentIdx] = {
                ...updatedParentArray[parentIdx],
                costs: updatedCosts,
            };

            return { ...prev, [field]: updatedParentArray };
        });
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrors({});

        // Calculate the total based on the current state of the payload
        const totalCost = calculateTotal(payload);

        // Create the final payload including the calculated total
        const finalPayload = {
            ...payload,
            total_proposal_cost: totalCost, // This updates the "0" you saw earlier
        };

        const combinedData = {
            ...summaryData,
            ...finalPayload,
        };

        console.log(finalPayload);

        const result = ProposalSchema.safeParse(combinedData);

        if (!result.success) {
            const formattedErrors: Record<string, string> = {};
            result.error.issues.forEach((issue) => {
                // Create a flat key for nested errors (e.g., "cost_by_components.0.component_name")
                formattedErrors[issue.path.join(".")] = issue.message;
            });
            setErrors(formattedErrors);
            setIsLoading(false);

            // Scroll to the first error
            const firstErrorKey = Object.keys(formattedErrors)[0];
            console.error("Validation failed", formattedErrors);
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch(
                project ? `/api/proposals/${project.id}` : "/api/proposals",
                {
                    method: project ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId,
                        entityId: entityId,
                        summaryData,
                        payload: finalPayload, // Send the version with the calculated total
                        auth_status: submitAction,
                    }),
                },
            );

            if (res.ok) {
                router.push("/forms/proposals");
            } else {
                // Consider adding error handling for non-ok responses
                const errorData = await res.json();
                console.error("Submission failed:", errorData);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }

    const handleMatrixChange = (
        field: FinancialTableKey,
        parentIdx: number,
        targetClass: "PS" | "MOOE" | "CO" | "FE",
        value: string,
    ) => {
        const parentArray = payload[field] as any[];
        const currentCosts = [...(parentArray[parentIdx].costs || [])];
        const existingIdx = currentCosts.findIndex(
            (c) => c.expense_class === targetClass,
        );

        if (existingIdx > -1) {
            // This likely still works as it uses updateExpense
            updateExpense(field, parentIdx, existingIdx, { amount: value });
        } else {
            // Create new entry for this expense class
            const newCosts = [
                ...currentCosts,
                { expense_class: targetClass, amount: value, currency: "PHP" },
            ];

            // FIX: Cast the update object as any to satisfy the complex union type
            updateRow(field, parentIdx, { costs: newCosts } as any);
        }
    };

    const calculateTotal = (payload: ProjectProposalPayload) => {
        // Sum from cost_by_components
        const componentTotal = payload.cost_by_components.reduce(
            (sum, comp) => {
                return (
                    sum +
                    comp.costs.reduce(
                        (cSum, c) => cSum + Number(c.amount || 0),
                        0,
                    )
                );
            },
            0,
        );

        console.log(componentTotal);

        return componentTotal;
    };

    const getAmount = (
        costs: ExpenseRow[],
        year: number,
        tier: number,
        expenseClass: string,
    ) => {
        return (
            costs.find(
                (c: any) =>
                    c.expense_class === expenseClass &&
                    c.year === year &&
                    (tier === null || c.tier === tier),
            )?.amount ?? ""
        );
    };

    const calculateRowTotal = (
        costs: ExpenseRow[],
        year: number,
        expenseClass: string,
    ) => {
        return costs
            .filter(
                (c: any) => c.year === year && c.expense_class === expenseClass,
            )
            .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    };

    const handleMatrixUpdate = (
        parentIdx: number,
        year: number,
        tier: number | null,
        expenseClass: string,
        value: string,
    ) => {
        setPayload((prev) => {
            const updatedAttributions = [...prev.local_financial_attributions];
            const currentCosts = [
                ...(updatedAttributions[parentIdx].costs || []),
            ];

            const existingIdx = currentCosts.findIndex(
                (c: any) =>
                    c.year === year &&
                    c.tier === tier &&
                    c.expense_class === expenseClass,
            );

            if (existingIdx > -1) {
                currentCosts[existingIdx] = {
                    ...currentCosts[existingIdx],
                    amount: value,
                };
            } else {
                currentCosts.push({
                    expense_class: expenseClass as any,
                    amount: value,
                    currency: "PHP",
                    year,
                    tier,
                } as any);
            }

            updatedAttributions[parentIdx] = {
                ...updatedAttributions[parentIdx],
                costs: currentCosts,
            };

            return {
                ...prev,
                local_financial_attributions: updatedAttributions,
            };
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="max-w-5xl mx-auto mt-8 px-4 pb-24 space-y-8"
        >
            <div className="p-4 bg-muted-50 border-l-4 border-muted-600 rounded-r-lg">
                <h2 className="text-lg font-bold text-muted-800">
                    BP Form {type}:{" "}
                    {type === "202" ? "New Project" : "Expansion"}
                </h2>
            </div>

            <div className="grid grid-cols-2 gap-6 bg-background p-6 rounded-xl border shadow-sm">
                <div className="flex flex-col gap-2">
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-muted-400">
                            Project Title
                        </label>
                        <input
                            className={`w-full border-b outline-none py-2 text-lg ${
                                errors.title
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={summaryData.title}
                            onChange={(e) =>
                                setSummaryData({
                                    ...summaryData,
                                    title: e.target.value,
                                })
                            }
                            placeholder="Enter Project Title..."
                        />
                        {errors.title && (
                            <p className="text-red-500 text-[10px] mt-1">
                                {errors.title}
                            </p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-muted-400">
                            Description
                        </label>
                        <textarea
                            className={`w-full border p-2 rounded text-sm ${
                                errors.description
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={summaryData.description}
                            onChange={(e) =>
                                setSummaryData({
                                    ...summaryData,
                                    description: e.target.value,
                                })
                            }
                        />
                        {errors.description && (
                            <p className="text-red-500 text-[10px]">
                                {errors.description}
                            </p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-muted-400">
                            Organizational Outcome
                        </label>
                        <textarea
                            className={`w-full border p-2 rounded text-sm ${
                                errors.org_outcome_id
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={summaryData.org_outcome_id}
                            onChange={(e) =>
                                setSummaryData({
                                    ...summaryData,
                                    org_outcome_id: e.target.value,
                                })
                            }
                        />
                        {errors.org_outcome_id && (
                            <p className="text-red-500 text-[10px]">
                                {errors.org_outcome_id}
                            </p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-muted-400">
                            Purpose
                        </label>
                        <textarea
                            className={`w-full border p-2 rounded text-sm ${
                                errors.purpose
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={summaryData.purpose}
                            onChange={(e) =>
                                setSummaryData({
                                    ...summaryData,
                                    purpose: e.target.value,
                                })
                            }
                        />
                        {errors.purpose && (
                            <p className="text-red-500 text-[10px]">
                                {errors.purpose}
                            </p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black uppercase text-muted-400">
                            Beneficiaries
                        </label>
                        <textarea
                            className={`w-full border p-2 rounded text-sm ${
                                errors.beneficiaries
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={summaryData.beneficiaries}
                            onChange={(e) =>
                                setSummaryData({
                                    ...summaryData,
                                    beneficiaries: e.target.value,
                                })
                            }
                        />
                        {errors.beneficiaries && (
                            <p className="text-red-500 text-[10px]">
                                {errors.beneficiaries}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-muted-400">
                            Priority
                        </label>
                        <input
                            type="number"
                            className="w-full border-b border-muted-200 py-2 outline-none"
                            value={summaryData.priority_rank}
                            onChange={(e) =>
                                setSummaryData({
                                    ...summaryData,
                                    priority_rank: parseInt(e.target.value),
                                })
                            }
                        />
                    </div>
                    <div className="mb-6 p-4 bg-muted/50 border-l-4 border-muted-400 rounded-r-lg shadow-sm w-full col-span-full">
                        <span className="text-xs font-bold text-muted-500 uppercase tracking-widest">
                            Implementing Agency
                        </span>
                        <h2 className="text-lg font-semibold text-muted-800">
                            {entityName}
                        </h2>
                    </div>
                </div>
                <div>
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-muted-400 uppercase tracking-widest mb-4">
                            Project Classification
                        </h3>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-muted-300 text-blue-600 focus:ring-blue-500"
                                checked={payload.is_new}
                                onChange={(e) =>
                                    updateRow(
                                        "is_new",
                                        null as any,
                                        e.target.checked,
                                    )
                                }
                            />
                            <span className="text-sm font-medium text-muted-700 group-hover:text-blue-600 transition-colors">
                                New Project
                            </span>
                        </label>
                        {payload.is_new == true && (
                            <label className="ml-6 flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-muted-300 text-blue-600 focus:ring-blue-500"
                                    checked={payload.myca_issuance ?? false}
                                    onChange={(e) =>
                                        updateRow(
                                            "myca_issuance",
                                            null as any,
                                            e.target.checked,
                                        )
                                    }
                                />
                                <span className="text-sm font-medium text-muted-700 group-hover:text-blue-600 transition-colors">
                                    For MYCA Issuance
                                </span>
                            </label>
                        )}

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-muted-300 text-blue-600 focus:ring-blue-500"
                                checked={payload.is_infrastructure}
                                onChange={(e) =>
                                    updateRow(
                                        "is_infrastructure",
                                        null as any,
                                        e.target.checked,
                                    )
                                }
                            />
                            <span className="text-sm font-medium text-muted-700 group-hover:text-blue-600 transition-colors">
                                Infrastructure Project
                            </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-muted-300 text-blue-600 focus:ring-blue-500"
                                checked={payload.for_ict ?? false}
                                onChange={(e) =>
                                    updateRow("for_ict", null, e.target.checked)
                                }
                            />
                            <span className="text-sm font-medium text-muted-700 group-hover:text-blue-600 transition-colors">
                                Information & Communications Technology (ICT)
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="bg-background rounded-xl border shadow-sm overflow-hidden mb-6">
                <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                    <h3 className="text-[11px] font-black text-muted-500 uppercase tracking-widest">
                        PAP Prerequisites
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse border-spacing-0">
                        <thead>
                            <tr className="bg-background border-b">
                                <th
                                    rowSpan={2}
                                    className="py-4 px-4 text-[10px] font-bold text-muted-700 uppercase border-r w-1/3 text-center"
                                >
                                    Approving Authorities / Supporting Documents
                                </th>
                                <th
                                    colSpan={3}
                                    className="py-2 text-[10px] font-bold text-muted-700 uppercase border-b text-center"
                                >
                                    Reviewed/Approved
                                </th>
                                <th
                                    rowSpan={2}
                                    className="py-4 px-4 text-[10px] font-bold text-muted-700 uppercase border-l text-center"
                                >
                                    Remarks
                                </th>
                            </tr>
                            <tr className="bg-background border-b">
                                <th className="py-2 text-[9px] font-bold text-muted-500 uppercase text-center border-r w-20">
                                    Yes
                                </th>
                                <th className="py-2 text-[9px] font-bold text-muted-500 uppercase text-center border-r w-20">
                                    No
                                </th>
                                <th className="py-2 text-[9px] font-bold text-muted-500 uppercase text-center w-28">
                                    Not Applicable
                                </th>
                            </tr>
                        </thead>

                        {/* Section 1: Approving Authorities */}
                        <tbody>
                            <tr className="bg-muted-50/50 border-b">
                                <td
                                    colSpan={4}
                                    className="py-2 px-4 text-[10px] font-black text-muted-600 uppercase italic"
                                >
                                    Approving Authorities
                                </td>
                                <td className="flex flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            addRow("pap_prerequisites", {
                                                name: "",
                                                type: "authority",
                                                status: "Not Applicable",
                                                remarks: "",
                                            })
                                        }
                                        className="text-secondary-foreground-600 text-xs font-bold hover:underline py-2 px-4 text-right"
                                    >
                                        + ADD APPROVING AUTHORITY
                                    </button>
                                </td>
                            </tr>
                            {payload.pap_prerequisites.map(
                                (pre, i) =>
                                    pre.type === "authority" && (
                                        <PrerequisiteRow
                                            key={`auth-${i}`}
                                            pre={pre}
                                            index={i}
                                            updateRow={updateRow}
                                        />
                                    ),
                            )}
                        </tbody>

                        {/* Section 2: Supporting Documents */}
                        <tbody>
                            <tr className="bg-muted-50/50 border-b border-t">
                                <td
                                    colSpan={4}
                                    className="py-2 px-4 text-[10px] font-black text-muted-600 uppercase italic border-b border-t"
                                >
                                    Supporting Documents
                                </td>
                                <td className="flex flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            addRow("pap_prerequisites", {
                                                name: "",
                                                type: "document",
                                                status: "Not Applicable",
                                                remarks: "",
                                            })
                                        }
                                        className="text-secondary-foreground-600 text-xs font-bold hover:underline py-2 px-4"
                                    >
                                        + ADD SUPPORTING DOCUMENT
                                    </button>
                                </td>
                            </tr>
                            {payload.pap_prerequisites.map(
                                (pre, i) =>
                                    pre.type === "document" && (
                                        <PrerequisiteRow
                                            key={`doc-${i}`}
                                            pre={pre}
                                            index={i}
                                            updateRow={updateRow}
                                        />
                                    ),
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <div
                    className={`rounded-xl border shadow-sm overflow-hidden ${
                        errors.cost_by_components
                            ? "border-red-500 bg-red-50"
                            : "border-muted-200"
                    }`}
                >
                    <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                        <h3 className="text-xs font-black text-muted-500 uppercase tracking-widest">
                            COSTING BY COMPONENT(S)
                        </h3>
                        <button
                            type="button"
                            onClick={() =>
                                addRow("cost_by_components", {
                                    component_name: "",
                                    costs: [],
                                })
                            }
                            className="text-secondary-foreground-600 text-xs font-bold hover:underline"
                        >
                            + ADD COMPONENT
                        </button>
                    </div>

                    <div className="p-0">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-muted-50/50 border-b border-muted-100">
                                    <th className="py-3 px-4 text-[10px] font-black text-muted-400 uppercase w-1/3">
                                        Component Name
                                    </th>
                                    <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center">
                                        PS
                                    </th>
                                    <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center">
                                        MOOE
                                    </th>
                                    <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center">
                                        CO
                                    </th>
                                    <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center">
                                        FINEX
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-muted-50">
                                {payload.cost_by_components.map((comp, i) => {
                                    const errorKey = `cost_by_components.${i}.component_name`;
                                    return (
                                        <tr
                                            key={i}
                                            className="hover:bg-muted-50/30 transition-colors"
                                        >
                                            {/* Column 1: Name */}
                                            <td className="py-3 px-4">
                                                <input
                                                    className={`w-full bg-transparent font-medium text-muted-700 outline-none placeholder:text-muted-300 ${errors[errorKey] ? "border-red-500" : ""}}`}
                                                    placeholder="Component Name"
                                                    value={comp.component_name}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            "cost_by_components",
                                                            i,
                                                            {
                                                                component_name:
                                                                    e.target
                                                                        .value,
                                                            } as any,
                                                        )
                                                    }
                                                />
                                            </td>

                                            {/* Financial Columns */}
                                            {(
                                                [
                                                    "PS",
                                                    "MOOE",
                                                    "CO",
                                                    "FE",
                                                ] as const
                                            ).map((itemClass) => (
                                                <td
                                                    key={itemClass}
                                                    className="py-3 px-2"
                                                >
                                                    <input
                                                        type="number"
                                                        className="w-full bg-transparent text-right outline-none text-sm text-muted-600 focus:text-secondary-foreground-600"
                                                        placeholder="0"
                                                        value={
                                                            comp.costs.find(
                                                                (c) =>
                                                                    c.expense_class ===
                                                                    itemClass,
                                                            )?.amount ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            handleMatrixChange(
                                                                "cost_by_components",
                                                                i,
                                                                itemClass,
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {payload.cost_by_components.length === 0 && (
                            <div className="p-8 text-center text-muted-400 text-xs italic">
                                No components added. Click "+ ADD COMPONENT" to
                                begin.
                            </div>
                        )}
                    </div>
                </div>
                {errors.cost_by_components && (
                    <p className="text-red-500 text-[10px] mt-1">
                        {errors.cost_by_components}
                    </p>
                )}
            </div>

            {type === "202" && (
                <div className="space-y-8">
                    <div className="bg-background rounded-xl border shadow-sm overflow-hidden mb-6">
                        <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                            <h3 className="text-xs font-black text-muted-500 uppercase tracking-widest">
                                LOCATION OF IMPLEMENTATION
                            </h3>
                            <button
                                type="button"
                                onClick={() =>
                                    addRow("local_locations", {
                                        location: "",
                                        costs: [],
                                    })
                                }
                                className="text-secondary-foreground-600 text-xs font-bold hover:underline"
                            >
                                + ADD LOCATION
                            </button>
                        </div>
                        <div className="p-0">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th className="py-3 px-4 text-[10px] font-black text-muted-400 uppercase w-1/3">
                                            Location
                                        </th>
                                        <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center w-1/6 text-secondary-foreground-500 bg-secondary-foreground-50/30">
                                            PS
                                        </th>
                                        <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center w-1/6 bg-muted-50/30">
                                            MOOE
                                        </th>
                                        <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center w-1/6 bg-muted-50/30">
                                            CO
                                        </th>
                                        <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center w-1/6 bg-muted-50/30">
                                            FINEX
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted-50">
                                    {payload.local_locations.map((item, i) => (
                                        <tr key={i}>
                                            <td className="py-3 px-4">
                                                <input
                                                    className="w-full bg-transparent font-medium text-muted-700 outline-none"
                                                    placeholder="Region/Province"
                                                    value={item.location}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            "local_locations",
                                                            i,
                                                            {
                                                                location:
                                                                    e.target
                                                                        .value,
                                                            } as any,
                                                        )
                                                    }
                                                />
                                            </td>
                                            {(
                                                [
                                                    "PS",
                                                    "MOOE",
                                                    "CO",
                                                    "FE",
                                                ] as const
                                            ).map((itemClass) => (
                                                <td
                                                    key={itemClass}
                                                    className="py-2 px-2"
                                                >
                                                    <input
                                                        type="number"
                                                        className="w-full bg-transparent text-right outline-none text-sm"
                                                        placeholder="0"
                                                        value={
                                                            item.costs.find(
                                                                (c) =>
                                                                    c.expense_class ===
                                                                    itemClass,
                                                            )?.amount ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            handleMatrixChange(
                                                                "local_locations",
                                                                i,
                                                                itemClass,
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {payload.local_locations.length === 0 && (
                                <div className="p-8 text-center text-muted-400 text-xs italic">
                                    No components added. Click "+ ADD LOCATION"
                                    to begin.
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <div
                            className={`rounded-xl border shadow-sm overflow-hidden ${
                                errors.local_financial_attributions
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                        >
                            <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                                <h3 className="text-xs font-black text-muted-500 uppercase tracking-widest">
                                    LOCAL FINANCIAL ATTRIBUTION(S)
                                </h3>
                                <button
                                    type="button"
                                    onClick={() =>
                                        addRow("local_financial_attributions", {
                                            description: "",
                                            year: payload.proposal_year,
                                            tier: 1,
                                            total_amt: 0,
                                            costs: [],
                                        })
                                    }
                                    className="text-secondary-foreground-600 text-xs font-bold hover:underline"
                                >
                                    + ADD ATTRIBUTION
                                </button>
                            </div>

                            <div className="p-0">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-muted-50 border-b">
                                            <th
                                                rowSpan={2}
                                                className="py-4 px-4 text-[10px] font-bold text-muted-700 uppercase border-r text-center w-1/3"
                                            >
                                                PAP (A)
                                            </th>
                                            <th
                                                colSpan={3}
                                                className="py-2 text-[10px] font-bold text-muted-700 uppercase border-b border-r text-center"
                                            >
                                                FY {payload.proposal_year} (B)
                                            </th>
                                            <th
                                                rowSpan={2}
                                                className="py-4 px-4 text-[10px] font-bold text-muted-700 uppercase border-r text-center"
                                            >
                                                FY {payload.proposal_year + 1}{" "}
                                                Tier 1 (C)
                                            </th>
                                            <th
                                                rowSpan={2}
                                                className="py-4 px-4 text-[10px] font-bold text-muted-700 uppercase text-center"
                                            >
                                                FY {payload.proposal_year + 2}{" "}
                                                Tier 1 (D)
                                            </th>
                                        </tr>
                                        <tr className="bg-muted-50 border-b">
                                            <th className="py-2 text-[9px] font-bold text-muted-500 uppercase text-center border-r w-24">
                                                Tier 1
                                            </th>
                                            <th className="py-2 text-[9px] font-bold text-muted-500 uppercase text-center border-r w-24">
                                                Tier 2
                                            </th>
                                            <th className="py-2 text-[9px] font-bold text-muted-500 uppercase text-center border-r w-24">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-chart-5/10">
                                        {payload.local_financial_attributions.map(
                                            (attrib, i) => (
                                                <>
                                                    {/* PAP Description Header Row */}
                                                    <tr
                                                        key={`pap-${i}`}
                                                        className="bg-muted-50/30 border-t-indigo-500 z-5"
                                                    >
                                                        <td className="py-2 px-4 font-bold text-sm text-muted-800 text-left">
                                                            <input
                                                                className="flex-1 border-b text-sm"
                                                                placeholder="PAP"
                                                                value={
                                                                    attrib.description
                                                                }
                                                                onChange={(e) =>
                                                                    updateRow(
                                                                        "local_financial_attributions",
                                                                        i,
                                                                        {
                                                                            description:
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                        } as any,
                                                                    )
                                                                }
                                                            />
                                                        </td>
                                                    </tr>

                                                    {/* Expense Class Sub-Rows */}
                                                    {(
                                                        [
                                                            "PS",
                                                            "MOOE",
                                                            "CO",
                                                            "FE",
                                                        ] as const
                                                    ).map((itemClass) => (
                                                        <tr
                                                            key={`${i}-${itemClass}`}
                                                            className="hover:bg-muted-50/50"
                                                        >
                                                            <td className="py-2 px-8 text-xs text-muted-600 italic">
                                                                {itemClass}
                                                            </td>
                                                            {/* FY Current Tier 1 */}
                                                            <td className="border-l border-chart-1 p-0">
                                                                <input
                                                                    type="number"
                                                                    className="w-full text-right p-2 text-xs outline-none bg-transparent"
                                                                    value={getAmount(
                                                                        attrib.costs,
                                                                        payload.proposal_year,
                                                                        1,
                                                                        itemClass,
                                                                    )}
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleMatrixUpdate(
                                                                            i,
                                                                            payload.proposal_year,
                                                                            1,
                                                                            itemClass,
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            {/* FY Current Tier 2 */}
                                                            <td className="border-l border-chart-1 p-0">
                                                                <input
                                                                    type="number"
                                                                    className="w-full text-right p-2 text-xs outline-none bg-transparent"
                                                                    value={getAmount(
                                                                        attrib.costs,
                                                                        payload.proposal_year,
                                                                        2,
                                                                        itemClass,
                                                                    )}
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleMatrixUpdate(
                                                                            i,
                                                                            payload.proposal_year,
                                                                            2,
                                                                            itemClass,
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            {/* Total for Current Year */}
                                                            <td className="border-l border-chart-1 bg-muted-50/50 text-right px-2 text-xs font-bold">
                                                                {calculateRowTotal(
                                                                    attrib.costs,
                                                                    payload.proposal_year,
                                                                    itemClass,
                                                                )}
                                                            </td>
                                                            {/* FY+1 Tier 1 */}
                                                            <td className="border-l border-chart-1 p-0">
                                                                <input
                                                                    type="number"
                                                                    className="w-full text-right p-2 text-xs outline-none bg-transparent"
                                                                    value={getAmount(
                                                                        attrib.costs,
                                                                        payload.proposal_year +
                                                                            1,
                                                                        1,
                                                                        itemClass,
                                                                    )}
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleMatrixUpdate(
                                                                            i,
                                                                            payload.proposal_year +
                                                                                1,
                                                                            1,
                                                                            itemClass,
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            {/* FY+2 Tier 1 */}
                                                            <td className="border-l border-chart-1 p-0">
                                                                <input
                                                                    type="number"
                                                                    className="w-full text-right p-2 text-xs outline-none bg-transparent"
                                                                    value={getAmount(
                                                                        attrib.costs,
                                                                        payload.proposal_year +
                                                                            2,
                                                                        1,
                                                                        itemClass,
                                                                    )}
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        handleMatrixUpdate(
                                                                            i,
                                                                            payload.proposal_year +
                                                                                2,
                                                                            1,
                                                                            itemClass,
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </>
                                            ),
                                        )}
                                    </tbody>
                                </table>

                                {payload.local_financial_attributions.length ===
                                    0 && (
                                    <div className="p-8 text-center text-muted-400 text-xs italic">
                                        No attributions added. Click "+ ADD
                                        ATTRIBUTION" to begin.
                                    </div>
                                )}
                            </div>
                        </div>
                        {errors.local_financial_attributions && (
                            <p className="text-red-500 text-[10px] mt-1">
                                {errors.local_financial_attributions}
                            </p>
                        )}
                    </div>
                    <div className="bg-background rounded-xl border shadow-sm overflow-hidden mb-6">
                        <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                            <h3 className="text-xs font-black text-muted-500 uppercase tracking-widest">
                                Requirements for Operating Cost of
                                Infrastructure Project
                            </h3>
                            <button
                                type="button"
                                onClick={() =>
                                    addRow(
                                        "local_infrastructure_requirements",
                                        {
                                            description: "",
                                            year: 2026,
                                            total_amt: 0,
                                            costs: [],
                                        },
                                    )
                                }
                                className="text-secondary-foreground-600 text-xs font-bold hover:underline"
                            >
                                + ADD REQUIREMENT
                            </button>
                        </div>
                        <div className="p-0">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th className="py-3 px-4 text-[10px] font-black text-muted-400 uppercase w-1/3">
                                            Description
                                        </th>
                                        <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center">
                                            PS
                                        </th>
                                        <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center">
                                            MOOE
                                        </th>
                                        <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center">
                                            CO
                                        </th>
                                        <th className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center">
                                            FINEX
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted-50">
                                    {payload.local_infrastructure_requirements.map(
                                        (item, i) => (
                                            <tr key={i}>
                                                <td className="py-3 px-4">
                                                    <input
                                                        className="w-full bg-transparent font-medium text-muted-700 outline-none"
                                                        placeholder="Infrastructure Requirement"
                                                        value={item.description}
                                                        onChange={(e) =>
                                                            updateRow(
                                                                "local_infrastructure_requirements",
                                                                i,
                                                                {
                                                                    description:
                                                                        e.target
                                                                            .value,
                                                                } as any,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                {(
                                                    [
                                                        "PS",
                                                        "MOOE",
                                                        "CO",
                                                        "FE",
                                                    ] as const
                                                ).map((itemClass) => (
                                                    <td
                                                        key={itemClass}
                                                        className="py-2 px-2"
                                                    >
                                                        <input
                                                            type="number"
                                                            className="w-full bg-transparent text-right outline-none text-sm"
                                                            placeholder="0"
                                                            value={
                                                                item.costs.find(
                                                                    (c) =>
                                                                        c.expense_class ===
                                                                        itemClass,
                                                                )?.amount ?? ""
                                                            }
                                                            onChange={(e) =>
                                                                handleMatrixChange(
                                                                    "local_infrastructure_requirements",
                                                                    i,
                                                                    itemClass,
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>

                            {payload.local_infrastructure_requirements
                                .length === 0 && (
                                <div className="p-8 text-center text-muted-400 text-xs italic">
                                    No locations added. Click "+ ADD
                                    REQUIREMENT" to begin.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-background rounded-xl border shadow-sm overflow-hidden mb-6">
                        <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                            <h3 className="text-xs font-black text-muted-500 uppercase tracking-widest">
                                Local Physical Targets
                            </h3>
                            <button
                                type="button"
                                onClick={() =>
                                    addRow("local_physical_targets", {
                                        year: 2026,
                                        target_description: "",
                                    })
                                }
                                className="text-xs text-secondary-foreground-600 font-bold"
                            >
                                + ADD TARGET
                            </button>
                        </div>
                        {payload.local_physical_targets.map((target, i) => (
                            <div key={i} className="flex gap-4 mb-3 p-4">
                                <input
                                    className="flex-1 border-b text-sm"
                                    placeholder="Target Description"
                                    value={target.target_description}
                                    onChange={(e) =>
                                        updateRow("local_physical_targets", i, {
                                            target_description: e.target.value,
                                        } as any)
                                    }
                                />
                                <input
                                    type="number"
                                    className="w-24 border-b text-sm"
                                    placeholder="Year"
                                    value={target.year}
                                    onChange={(e) =>
                                        updateRow("local_physical_targets", i, {
                                            year: parseInt(e.target.value),
                                        } as any)
                                    }
                                />
                            </div>
                        ))}
                        {payload.local_physical_targets.length === 0 && (
                            <div className="p-8 text-center text-muted-400 text-xs italic">
                                No Local Physical Targets added. Click "+ ADD
                                TARGET" to begin.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 5. FOREIGN ASSISTANCE (BP 203 ONLY) */}
            {type === "203" && (
                <div className="space-y-8">
                    <div className="bg-background rounded-xl border shadow-sm p-4">
                        <h3 className="text-xs font-black text-orange-600 uppercase mb-4">
                            Foreign Financial Targets
                        </h3>
                        {payload.foreign_financial_targets.map((target, i) => (
                            <div
                                key={i}
                                className="mb-6 p-4 bg-orange-50/30 rounded-lg"
                            >
                                <input
                                    type="number"
                                    className="font-bold bg-transparent border-b mb-2"
                                    value={target.year}
                                    onChange={(e) =>
                                        updateRow(
                                            "foreign_financial_targets",
                                            i,
                                            {
                                                year: parseInt(e.target.value),
                                            } as any,
                                        )
                                    }
                                />
                                <ExpenseSubForm
                                    field="foreign_financial_targets"
                                    parentIdx={i}
                                    costs={(target as any).costs || []}
                                    updateRow={updateRow}
                                    updateExpense={updateExpense}
                                />
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() =>
                                addRow("foreign_financial_targets", {
                                    year: 2026,
                                    total_amt: 0,
                                    costs: [],
                                } as any)
                            }
                            className="text-xs text-orange-600 font-bold"
                        >
                            + ADD FINANCIAL YEAR
                        </button>
                    </div>

                    <div className="bg-background rounded-xl border shadow-sm p-4">
                        <h3 className="text-xs font-black text-muted-400 uppercase mb-4">
                            Foreign Physical Targets
                        </h3>
                        {payload.foreign_physical_targets.map((target, i) => (
                            <input
                                key={i}
                                className="w-full border-b mb-2 text-sm"
                                placeholder="Target Name/Description"
                                value={target.name}
                                onChange={(e) =>
                                    updateRow("foreign_physical_targets", i, {
                                        name: e.target.value,
                                    } as any)
                                }
                            />
                        ))}
                        <button
                            type="button"
                            onClick={() =>
                                addRow("foreign_physical_targets", { name: "" })
                            }
                            className="text-xs text-secondary-foreground-600 font-bold"
                        >
                            + ADD TARGET
                        </button>
                    </div>
                </div>
            )}

            <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex justify-end gap-3 z-50">
                <button
                    type="submit"
                    disabled={isLoading}
                    onClick={() => setSubmitAction("draft")}
                    className="px-6 py-2 text-muted-600 font-bold hover:bg-muted-50 rounded-lg"
                >
                    Save Draft
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    onClick={() => setSubmitAction("pending_budget")}
                    className="px-6 py-2 bg-secondary-foreground-600 text-primary-foreground font-bold rounded-lg shadow-md hover:bg-secondary-foreground-700"
                >
                    Submit Proposal
                </button>
            </div>
        </form>
    );
}
