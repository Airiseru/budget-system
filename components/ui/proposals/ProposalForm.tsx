"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProposalSchema } from "@/src/lib/validations/proposal.schema";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import SearchableComboboxField, {
    SearchableComboboxOption,
} from "@/components/ui/dbm/SearchableComboboxField";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import type { ItemCatalogOption } from "@/src/db/postgres/repositories/itemRepository";
import type { UacsFundingSource } from "@/src/types/uacs";
import type { FullProjectProposal } from "@/src/types/project_proposals";
import type { PapOption } from "@/src/db/postgres/repositories/papRepository";
import { EXPENSE_CLASSES } from "@/src/lib/constants";

interface AttributionYearTier {
    year: number;
    tier: number;
    costs: ExpenseRow[]; // Contains PS, MOOE, CO, FINEX for this specific Year+Tier
}

interface LocalFinancialAttribution {
    description: string;
    attribution_costs: AttributionYearTier[];
}

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

function getCostRowsTotal(costs: ExpenseRow[] = []) {
    return costs.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
}

type Bp203FundMethod = "cash" | "non_cash";

function normalizeBp203FundMethod(
    method?: ExpenseRow["fund_method"],
): Bp203FundMethod | null {
    if (method === "cash") return "cash";
    if (method === "non_cash" || method === "non-cash") return "non_cash";
    return null;
}

function normalizeBp203CostRows(
    component: Omit<CostingComponent, "costs"> & { costs?: ExpenseRow[] },
): ExpenseRow[] {
    const amount = Number(component.proposed_amt || 0);
    const expenseClass = component.costs?.[0]?.expense_class ?? "MOOE";

    if (!component.costs?.length && amount > 0) {
        return [{
            expense_class: expenseClass,
            amount,
            currency: component.currency || "PHP",
            fund_category: "LP",
            fund_method: "cash",
        }];
    }

    return (component.costs ?? []).map((cost) => ({
        ...cost,
        currency: cost.currency || component.currency || "PHP",
        fund_category: cost.fund_category ?? "LP",
        fund_method: normalizeBp203FundMethod(cost.fund_method) ?? "cash",
    }));
}

type ProjectProposalField =
    | "cost_by_components"
    | "local_locations"
    | "local_financial_attributions"
    | "local_infrastructure_requirements"
    | "foreign_financial_targets"
    | "foreign_physical_targets";

type MatrixField = "cost_by_components" | "foreign_physical_targets";
type Bp203FundCategory = "LP" | "GOP";

interface ExpenseRow {
    expense_class: keyof typeof EXPENSE_CLASSES;
    fund_category?: "LP" | "Grant" | "GOP" | null; // for BP 203
    fund_method?:
        | "cash"
        | "non_cash"
        | "non-cash"
        | "imprest"
        | "direct_payment"
        | null; // for BP 203
    currency: string;
    amount: number;
}

interface ForeignFinTarget {
    year: number;
    lp_imprest: number;
    lp_direct: number;
    grant: number;
    gop: number;
}

interface CostingComponent {
    component_name: string;
    item_catalog_id?: string | null;
    fund_code?: string | null;
    specific_description?: string | null;
    currency?: string;
    proposed_amt?: number | string;
    tier?: 2;
    costs: ExpenseRow[];
}

interface ProjectProposalPayload {
    title: string;

    proposal_year: number;
    priority_rank: number;
    org_outcome_id: string;
    description: string;
    purpose: string;
    beneficiaries: string;

    is_new: boolean;
    existing_pap_id: string;
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

    cost_by_components: CostingComponent[];
    local_locations: { location: string; costs: ExpenseRow[] }[];

    local_financial_attributions: LocalFinancialAttribution[];
    local_physical_targets: { year: number; target_description: string }[];
    local_infrastructure_requirements: {
        description: string;
        year: number;
        total_amt: number | string;
        costs: ExpenseRow[];
    }[];

    foreign_financial_targets: ForeignFinTarget[];
    foreign_physical_targets: { name: string; costs: ExpenseRow[] }[];
}

type ProposalFormProject = Omit<
    FullProjectProposal,
    | "cost_by_components"
    | "foreign_physical_targets"
    | "pap_prerequisites"
    | "local_locations"
    | "local_financial_attributions"
    | "local_physical_targets"
    | "local_infrastructure_requirements"
    | "foreign_financial_targets"
> & {
    pap_prerequisites?: ProjectProposalPayload["pap_prerequisites"];
    cost_by_components?: (Omit<CostingComponent, "costs"> & {
        costs?: ExpenseRow[];
    })[];
    local_locations?: ProjectProposalPayload["local_locations"];
    local_financial_attributions?: ProjectProposalPayload["local_financial_attributions"];
    local_physical_targets?: ProjectProposalPayload["local_physical_targets"];
    local_infrastructure_requirements?: ProjectProposalPayload["local_infrastructure_requirements"];
    foreign_financial_targets?: ProjectProposalPayload["foreign_financial_targets"];
    foreign_physical_targets?: (Omit<
        ProjectProposalPayload["foreign_physical_targets"][number],
        "costs"
    > & { costs?: ExpenseRow[] })[];
};

type ProposalPrerequisite = ProjectProposalPayload["pap_prerequisites"][number];
type ArrayFieldKey = {
    [K in keyof ProjectProposalPayload]: ProjectProposalPayload[K] extends unknown[]
        ? K
        : never;
}[keyof ProjectProposalPayload] &
    keyof ProjectProposalPayload;
type ArrayItem<K extends ArrayFieldKey> = K extends keyof ProjectProposalPayload
    ? ProjectProposalPayload[K] extends (infer U)[]
        ? U
        : never
    : never;
type NonArrayFieldKey = Exclude<keyof ProjectProposalPayload, ArrayFieldKey>;

interface PrerequisiteRowProps {
    pre: ProposalPrerequisite;
    placeholder: string;
    index: number;
    updateRow: <K extends ArrayFieldKey & keyof ProjectProposalPayload>(
        field: K,
        index: number,
        value: Partial<ArrayItem<K>>,
    ) => void;
    removeRow: <K extends ArrayFieldKey & keyof ProjectProposalPayload>(
        field: K,
        index: number,
    ) => void;
}

const PrerequisiteRow = ({
    pre,
    placeholder,
    index,
    updateRow,
    removeRow,
}: PrerequisiteRowProps) => (
    <tr className="border-b border-muted-100 last:border-0 hover:bg-muted-50/30 transition-colors">
        <td className="py-3 px-4 text-sm text-muted-700 font-medium border-r bg-background">
            <input
                className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-secondary-foreground"
                placeholder={placeholder}
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
                className="w-4 h-4 rounded border-muted-300 text-secondary-foreground"
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
                className="w-full bg-transparent text-sm outline-none border-b border-transparent focus:border-secondary-foreground-200"
                placeholder="Remarks..."
                value={pre.remarks ?? ""}
                onChange={(e) =>
                    updateRow("pap_prerequisites", index, {
                        remarks: e.target.value,
                    })
                }
            />
        </td>
        {index >= 13 && (
            <td>
                <button
                    onClick={() => removeRow("pap_prerequisites", index)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                >
                    ✕
                </button>
            </td>
        )}
    </tr>
);

interface WrapperProps {
    project?: ProposalFormProject;
    type: "202" | "203";
    userId: string;
    entityName: string;
    entityId: string;
    activeFiscalYear?: number;
    itemCatalogs?: ItemCatalogOption[];
    fundingSources?: UacsFundingSource[];
    existingPaps?: PapOption[];
}

type CollapsibleSection =
    | "cost_by_components"
    | "local_locations"
    | "local_financial_attributions"
    | "local_infrastructure_requirements"
    | "local_physical_targets"
    | "foreign_financial_targets"
    | "foreign_physical_targets";

interface CollapsibleTableSectionProps {
    section: CollapsibleSection;
    title: string;
    subtitle?: string;
    collapsed: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    summary?: React.ReactNode;
    actions?: React.ReactNode;
}

function CollapsibleTableSection({
    title,
    subtitle,
    collapsed,
    onToggle,
    children,
    summary,
    actions,
}: CollapsibleTableSectionProps) {
    return (
        <div className="rounded-xl border border-muted-200 overflow-hidden bg-inherit">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-muted-200 px-5 py-4 bg-inherit">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onToggle}
                        className="
                                
                        
                                p-1
                                text-sm
                                font-medium
                                text-muted-600
                                transition
                                hover:bg-muted-100
                            "
                    >
                        {collapsed ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-bold text-muted-700">
                                {title}
                            </h3>
                        </div>

                        {subtitle && (
                            <p className="mt-1 text-sm text-muted-500">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {actions && (
                    <div className="flex items-center gap-2">{actions}</div>
                )}
            </div>

            {/* Summary when collapsed */}
            {collapsed && summary && (
                <div className="px-5 py-4 bg-inherit">{summary}</div>
            )}

            {/* Content */}
            {!collapsed && <div className="bg-inherit">{children}</div>}
        </div>
    );
}

export default function ProposalForm({
    project,
    type,
    userId,
    entityName,
    entityId,
    activeFiscalYear,
    itemCatalogs = [],
    fundingSources = [],
    existingPaps = [],
}: WrapperProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isDbmOverwrite = project?.auth_status === "pending_dbm";
    const [submitAction, setSubmitAction] = useState<
        "draft" | "pending_budget" | "pending_dbm"
    >(isDbmOverwrite ? "pending_dbm" : "draft");
    const [overrideRemarks, setOverrideRemarks] = useState("");

    const availablePaps = existingPaps ?? [];
    const hasExistingPaps = availablePaps.length > 0;

    const [selectedPapId, setSelectedPapId] = useState<string>(
        project?.pap_id ?? "",
    );

    const [payload, setPayload] = useState<ProjectProposalPayload>({
        title: project?.title || "",
        proposal_year:
            project?.proposal_year ||
            activeFiscalYear ||
            new Date().getFullYear() + 1,
        priority_rank: project?.priority_rank || 1,
        org_outcome_id: project?.org_outcome_id || "",
        description: project?.description || "",
        purpose: project?.purpose || "",
        beneficiaries: project?.beneficiaries || "",
        is_new: project?.is_new ?? (hasExistingPaps ? false : true),
        existing_pap_id: project?.pap_id || "",
        myca_issuance: project?.myca_issuance ?? false,
        is_infrastructure: project?.is_infrastructure ?? false,
        for_ict: project?.for_ict ?? false,
        total_proposal_currency: project?.total_proposal_currency || "PHP",
        total_proposal_cost: project?.total_proposal_cost || 0,
        type: type,

        pap_prerequisites: project?.pap_prerequisites || DEFAULT_PREREQUISITES,
        cost_by_components:
            project?.cost_by_components?.map((component) => ({
                ...component,
                costs:
                    type === "203"
                        ? normalizeBp203CostRows(component)
                        : component.costs ?? [],
                proposed_amt:
                    type === "203"
                        ? Number(component.proposed_amt || getCostRowsTotal(normalizeBp203CostRows(component)) || 0)
                        : component.proposed_amt,
            })) || [],

        local_locations: project?.local_locations?.length
            ? project?.local_locations?.length > 0
                ? project?.local_locations
                : []
            : [],

        local_financial_attributions:
            project?.local_financial_attributions || [],
        local_physical_targets: project?.local_physical_targets || [],
        local_infrastructure_requirements:
            project?.local_infrastructure_requirements || [],
        foreign_financial_targets: project?.foreign_financial_targets || [],
        foreign_physical_targets:
            project?.foreign_physical_targets?.map((target) => ({
                ...target,
                costs: target.costs ?? [],
            })) || [],
    });

    useEffect(() => {
        if (!hasExistingPaps) {
            setPayload((prev) => ({
                ...prev,
                is_new: true,
            }));
        }
    }, [hasExistingPaps]);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [bp203Selections, setBp203Selections] = useState<
        Record<number, { category?: Bp203FundCategory; method?: Bp203FundMethod }>
    >({});

    const itemCatalogOptions: SearchableComboboxOption[] = itemCatalogs.map(
        (item) => ({
            value: item.id,
            label: `${item.name} (${item.expense_class})`,
        }),
    );

    const fundingSourceOptions: SearchableComboboxOption[] = fundingSources.map(
        (source) => ({
            value: source.code,
            label: `${source.code} - ${source.description}`,
        }),
    );

    const getSelectedItemCatalog = (id?: string | null) =>
        itemCatalogs.find((item) => item.id === id);

    const getErrorsForPath = (pathPrefix: string) => {
        return Object.entries(errors)
            .filter(([key]) => key.startsWith(pathPrefix))
            .map(([, message]) => message);
    };

    const getFriendlyErrorMessage = (path: string, message: string) => {
        // Mapping of technical keys to friendly display names
        const tableNames: Record<string, string> = {
            cost_by_components: "Component",
            foreign_physical_targets: "Physical Target",
            foreign_financial_targets: "Financial Target",
            pap_prerequisites: "Prerequisite",
            local_locations: "Location",
            local_financial_attributions: "Financial Attribution",
            local_infrastructure_requirements: "Infrastructure Requirement",
        };

        // Helper to capitalize words
        const toTitleCase = (str: string) =>
            str.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

        const ordinal = (n: number) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        // Check for nested paths: tablename.index.field
        const match = path.match(/^(.+?)\.(\d+)\.(.+)$/);

        if (match) {
            const [, tableKey, index, field] = match;
            const tableName = tableNames[tableKey] || toTitleCase(tableKey);
            const fieldName = toTitleCase(field);
            const position = ordinal(parseInt(index) + 1);

            return `${message} in ${position} ${tableName} (${fieldName})`;
        }

        // Fallback for simple paths (e.g., "title", "org_outcome_id")
        return `${toTitleCase(path)}: ${message}`;
    };

    const addRow = <K extends keyof ProjectProposalPayload>(
        field: K,
        defaultValue: ProjectProposalPayload[K] extends (infer U)[] ? U : never,
    ) => {
        setPayload((prev) => ({
            ...prev,
            [field]: [
                ...(prev[field] as Array<typeof defaultValue>),
                defaultValue,
            ],
        }));
    };

    function updateRow<K extends NonArrayFieldKey>(
        field: K,
        index: undefined,
        value: ProjectProposalPayload[K],
    ): void;
    function updateRow<K extends ArrayFieldKey>(
        field: K,
        index: number,
        value: Partial<ArrayItem<K>>,
    ): void;
    function updateRow<K extends keyof ProjectProposalPayload>(
        field: K,
        index: number | undefined,
        value: unknown,
    ) {
        setPayload((prev) => {
            if (index === undefined) {
                if (field === "is_infrastructure" && value === false) {
                    return {
                        ...prev,
                        is_infrastructure: false,
                        local_infrastructure_requirements: [],
                    };
                }

                return {
                    ...prev,
                    [field]: value as ProjectProposalPayload[K],
                };
            }

            const currentArray = prev[field];
            if (Array.isArray(currentArray)) {
                const updatedArray = [...currentArray];
                updatedArray[index] =
                    typeof value === "object" && value !== null
                        ? {
                              ...updatedArray[index],
                              ...(value as Record<string, unknown>),
                          }
                        : updatedArray[index];
                return { ...prev, [field]: updatedArray };
            }

            return prev;
        });
    }

    const removeRow = <K extends ArrayFieldKey>(field: K, index: number) => {
        setPayload((prev) => {
            const currentArray = prev[field] as unknown[];
            if (Array.isArray(currentArray)) {
                return {
                    ...prev,
                    [field]: currentArray.filter((_, i) => i !== index),
                };
            }
            return prev;
        });
    };

    const [collapsedSections, setCollapsedSections] = useState<
        Record<CollapsibleSection, boolean>
    >({
        cost_by_components: false,
        local_locations: false,
        local_financial_attributions: false,
        local_infrastructure_requirements: false,
        local_physical_targets: false,
        foreign_financial_targets: false,
        foreign_physical_targets: false,
    });

    const toggleSection = (section: CollapsibleSection) => {
        setCollapsedSections((prev) => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const updateExpense = (
        field: ProjectProposalField,
        parentIdx: number,
        expIdx: number,
        value: Partial<ExpenseRow>,
    ) => {
        setPayload((prev) => {
            const updatedParentArray = [
                ...(prev[field] as Array<{ costs: ExpenseRow[] }>),
            ];
            const updatedCosts = [...updatedParentArray[parentIdx].costs];

            updatedCosts[expIdx] = { ...updatedCosts[expIdx], ...value };
            updatedParentArray[parentIdx] = {
                ...updatedParentArray[parentIdx],
                costs: updatedCosts,
            };

            return { ...prev, [field]: updatedParentArray };
        });
    };

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrors({});

        const normalizedComponents = payload.cost_by_components.map((comp) => {
            const selectedItem = getSelectedItemCatalog(comp.item_catalog_id);
            const expenseClass =
                selectedItem?.expense_class || comp.costs[0]?.expense_class || "MOOE";
            const costs = payload.type === "203"
                ? normalizeBp203CostRows({
                      ...comp,
                      costs: comp.costs.length
                          ? comp.costs.map((cost) => ({
                                ...cost,
                                expense_class: cost.expense_class || expenseClass,
                            }))
                          : [{
                                expense_class: expenseClass,
                                amount: Number(comp.proposed_amt || 0),
                                currency: comp.currency || "PHP",
                                fund_category: "LP",
                                fund_method: "cash",
                            }],
                  })
                : [{
                      expense_class: expenseClass,
                      amount: Number(comp.proposed_amt || comp.costs[0]?.amount || 0),
                      currency: comp.currency || comp.costs[0]?.currency || "PHP",
                  }];

            return {
                ...comp,
                component_name:
                    selectedItem?.name ||
                    comp.component_name ||
                    "",
                tier: 2 as const,
                currency: comp.currency || costs[0]?.currency || "PHP",
                proposed_amt: Number(comp.proposed_amt || getCostRowsTotal(costs) || 0),
                costs,
            };
        });
        const normalizedLocalFinancialAttributions = payload.local_financial_attributions.map((attribution) => ({
            ...attribution,
            attribution_costs: payload.is_new
                ? attribution.attribution_costs.filter(
                      (cost) =>
                          !(
                              cost.year === payload.proposal_year &&
                              cost.tier === 1
                          ),
                  )
                : attribution.attribution_costs,
        }));

        const finalPayload = {
            ...payload,
            local_financial_attributions: normalizedLocalFinancialAttributions,
            local_infrastructure_requirements: payload.is_infrastructure
                ? payload.local_infrastructure_requirements
                : [],
            cost_by_components: normalizedComponents,
            total_proposal_cost: calculateTotal({
                ...payload,
                local_infrastructure_requirements: payload.is_infrastructure
                    ? payload.local_infrastructure_requirements
                    : [],
                cost_by_components: normalizedComponents,
            }),
        };

        const result = ProposalSchema.safeParse(finalPayload);

        if (!result.success) {
            const formattedErrors: Record<string, string> = {};

            result.error.issues.forEach((issue) => {
                // Path will look like "cost_by_components.0.component_name"
                const path = issue.path.join(".");
                formattedErrors[path] = issue.message;
            });

            setErrors(formattedErrors); // This now matches Record<string, string>
            setIsLoading(false);
            // toast.error("Please fix the errors before submitting");
            // Scroll to the first error
            window.scrollTo({ top: 0, behavior: "smooth" });
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
                        payload: result.data, // Send the version with the calculated total
                        auth_status: submitAction,
                        existingPapId: payload.is_new
                            ? undefined
                            : selectedPapId,
                        isDbm: isDbmOverwrite,
                        overrideRemarks: isDbmOverwrite
                            ? overrideRemarks
                            : undefined,
                    }),
                },
            );

            if (res.ok) {
                const data = await res.json();
                router.refresh();
                router.push(
                    data.papId || project?.id
                        ? `/forms/proposals/${data.formId ?? project?.id}`
                        : "/forms/proposals",
                );
            } else {
                const errorData = await res.json();
                if (
                    errorData.code === "23505" ||
                    errorData.error?.includes("unique_entity_rank")
                ) {
                    setErrors({
                        priority_rank:
                            "This priority rank is already taken by another proposal.",
                    });
                } else {
                    setErrors({
                        general: errorData.error || "Failed to save proposal.",
                    });
                }
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        } catch {
            // toast.error("An unexpected error occurred. Please try again.");
            setErrors({
                general: "An unexpected error occurred. Please try again.",
            });
        } finally {
            setIsLoading(false);
        }
    }

    const handleMatrixChange = (
        field: ProjectProposalField,
        parentIdx: number,
        targetClass: keyof typeof EXPENSE_CLASSES,
        value: number,
    ) => {
        // Treat the array specifically as ExpenseRow-based for this function
        const parentArray = payload[field] as { costs: ExpenseRow[] }[];
        const currentCosts = [...(parentArray[parentIdx].costs || [])];

        const existingIdx = currentCosts.findIndex(
            (c) => c.expense_class === targetClass,
        );

        if (existingIdx > -1) {
            updateExpense(field, parentIdx, existingIdx, { amount: value });
        } else {
            const newCosts: ExpenseRow[] = [
                ...currentCosts,
                { expense_class: targetClass, amount: value, currency: "PHP" },
            ];
            // Cast the update to any to bypass the union check here
            updateRow(field, parentIdx, { costs: newCosts });
        }
    };

    const handleMatrixChange203 = (
        componentIdx: number,
        expenseClass: keyof typeof EXPENSE_CLASSES,
        category: "LP" | "Grant" | "GOP",
        value: number,
        field: MatrixField,
        method?: Bp203FundMethod,
    ) => {
        setPayload((prev) => {
            const updatedComponents = [...prev[field]];
            const currentComp = { ...updatedComponents[componentIdx] };
            const currentCosts = [...(currentComp.costs || [])];

            // Unique identifier: Match by class AND category AND method
            const costIdx = currentCosts.findIndex(
                (c) =>
                    c.expense_class === expenseClass &&
                    c.fund_category === category &&
                    (category !== "LP" ||
                        normalizeBp203FundMethod(c.fund_method) === method),
            );

            if (costIdx > -1) {
                currentCosts[costIdx] = {
                    ...currentCosts[costIdx],
                    amount: value,
                };
            } else {
                currentCosts.push({
                    expense_class: expenseClass,
                    fund_category: category,
                    fund_method: method,
                    currency: "PHP",
                    amount: value,
                });
            }

            currentComp.costs = currentCosts;
            if ("proposed_amt" in currentComp) {
                (currentComp as CostingComponent).proposed_amt = value;
            }
            updatedComponents[componentIdx] = currentComp;

            return { ...prev, [field]: updatedComponents };
        });
    };

    const calculateTotal = (payload: ProjectProposalPayload) => {
        return payload.cost_by_components.reduce((sum, comp) => {
            const proposedAmount =
                comp.proposed_amt === undefined || comp.proposed_amt === null
                    ? null
                    : Number(comp.proposed_amt || 0);

            if (proposedAmount !== null) {
                return sum + proposedAmount;
            }

            const rowTotal = comp.costs.reduce((cSum, c) => {
                return cSum + Number(c.amount || 0);
            }, 0);

            return sum + rowTotal;
        }, 0);
    };

    const addCostComponent = () =>
        addRow("cost_by_components", {
            component_name: "",
            item_catalog_id: "",
            fund_code: "",
            specific_description: "",
            currency: "PHP",
            proposed_amt: 0,
            tier: 2,
            costs: [],
        });

    const updateCostComponentItem = (index: number, itemCatalogId: string) => {
        const selectedItem = getSelectedItemCatalog(itemCatalogId);
        const currentComponent = payload.cost_by_components[index];
        const amount = Number(currentComponent?.proposed_amt || 0);
        const expenseClass = selectedItem?.expense_class ?? "MOOE";
        const costs = selectedItem
            ? payload.type === "203"
                ? normalizeBp203CostRows({
                      ...currentComponent,
                      costs: currentComponent?.costs?.length
                          ? currentComponent.costs.map((cost) => ({
                                ...cost,
                                expense_class: expenseClass,
                            }))
                          : [{
                                expense_class: expenseClass,
                                amount,
                                currency: currentComponent?.currency || "PHP",
                                fund_category: "LP",
                                fund_method: "cash",
                            }],
                  })
                : [{
                      expense_class: expenseClass,
                      amount,
                      currency: currentComponent?.currency || "PHP",
                  }]
            : [];

        updateRow("cost_by_components", index, {
            item_catalog_id: itemCatalogId,
            component_name: selectedItem?.name ?? "",
            costs,
        });
    };

    type ExpenseKey = "PS" | "MOOE" | "CO" | "FINEX";

    const componentExpenseClassTotals = payload.cost_by_components.reduce(
        (acc, comp) => {
            const selectedItem = getSelectedItemCatalog(comp.item_catalog_id);

            const expenseClass = selectedItem?.expense_class as ExpenseKey;

            const amount = Number(comp.proposed_amt || 0);

            if (
                expenseClass &&
                Object.keys(EXPENSE_CLASSES).includes(expenseClass)
            ) {
                acc[expenseClass] += amount;
            }

            return acc;
        },
        {
            PS: 0,
            MOOE: 0,
            CO: 0,
            FINEX: 0,
        },
    );

    const renderCostComponentAllocationTable = (showGroupHover = false) => {
        const grandTotal = (
            Object.values(componentExpenseClassTotals) as number[]
        ).reduce((a, b) => a + b, 0);

        return (
            <div className="bg-inherit">
                {/* Scrollable Table */}
                <div className="max-h-[520px] bg-inherit overflow-auto">
                    <table className="w-full bg-inherit border-spacing-0">
                        <thead className="sticky top-0 z-20 border-b bg-inherit border-secondary-foreground">
                            <tr className="border-b border-secondary-foreground">
                                <th className="bg-muted-50 px-4 py-4 text-left text-sm font-bold text-muted-600 w-[280px]">
                                    Item Catalog
                                </th>

                                <th className="bg-muted-50 px-4 py-4 text-left text-sm font-bold text-muted-600 min-w-[220px]">
                                    Fund Source
                                </th>

                                <th className="bg-muted-50 px-4 py-4 text-left text-sm font-bold text-muted-600 min-w-[120px]">
                                    Description
                                </th>

                                <th className="bg-muted-50 px-3 py-4 text-center text-sm font-bold text-muted-600 w-24">
                                    Currency
                                </th>

                                <th className="bg-muted-50 px-4 py-4 text-center text-sm font-bold text-muted-600 w-44">
                                    Proposed Amount
                                </th>

                                <th className="bg-muted-50 w-12" />
                            </tr>
                        </thead>

                        <tbody>
                            {payload.cost_by_components.map((comp, i) => {
                                const selectedItem = getSelectedItemCatalog(
                                    comp.item_catalog_id,
                                );

                                return (
                                    <tr
                                        key={i}
                                        className={`
                                        border-b border-muted-100
                                        transition-colors
                                        hover:bg-muted-50/60
                                        ${showGroupHover ? "group" : ""}
                                    `}
                                    >
                                        {/* Item Catalog */}
                                        <td className="px-4 py-4 align-top">
                                            <div className="space-y-2">
                                                <SearchableComboboxField
                                                    items={itemCatalogOptions}
                                                    value={
                                                        comp.item_catalog_id ??
                                                        ""
                                                    }
                                                    placeholder="Select item catalog"
                                                    searchPlaceholder="Search line items"
                                                    emptyText="No line items found."
                                                    onValueChange={(value) =>
                                                        updateCostComponentItem(
                                                            i,
                                                            value,
                                                        )
                                                    }
                                                />

                                                {selectedItem && (
                                                    <div className="inline-flex items-center rounded-md bg-muted-100 px-2 py-1 text-sm font-medium text-muted-600">
                                                        {
                                                            selectedItem.expense_class
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Fund Source */}
                                        <td className="px-4 py-4 align-top">
                                            <SearchableComboboxField
                                                items={fundingSourceOptions}
                                                value={comp.fund_code ?? ""}
                                                placeholder="Select fund source"
                                                searchPlaceholder="Search fund sources"
                                                emptyText="No fund sources found."
                                                onValueChange={(value) =>
                                                    updateRow(
                                                        "cost_by_components",
                                                        i,
                                                        {
                                                            fund_code: value,
                                                        },
                                                    )
                                                }
                                            />
                                        </td>

                                        {/* Description */}
                                        <td className="px-4 py-4 align-top">
                                            <textarea
                                                className="
                                                min-h-[88px]
                                                w-full
                                                resize-none
                                                rounded-lg
                                                border
                                                border-muted-200
                                                bg-background
                                                px-3
                                                py-2
                                                text-sm
                                                outline-none
                                                transition
                                                focus:border-secondary-foreground/40
                                                focus:ring-2
                                                focus:ring-secondary-foreground/10
                                            "
                                                placeholder="Optional description"
                                                value={
                                                    comp.specific_description ??
                                                    ""
                                                }
                                                onChange={(e) =>
                                                    updateRow(
                                                        "cost_by_components",
                                                        i,
                                                        {
                                                            specific_description:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                            />
                                        </td>

                                        {/* Currency */}
                                        <td className="px-3 py-4 align-top">
                                            <input
                                                className="
                                                w-full
                                                rounded-lg
                                                border
                                                border-muted-200
                                                bg-background
                                                px-2
                                                py-2
                                                text-center
                                                text-sm
                                                font-medium
                                                uppercase
                                                outline-none
                                                transition
                                                focus:border-secondary-foreground/40
                                                focus:ring-2
                                                focus:ring-secondary-foreground/10
                                            "
                                                value={comp.currency ?? "PHP"}
                                                onChange={(e) =>
                                                    updateRow(
                                                        "cost_by_components",
                                                        i,
                                                        {
                                                            currency:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                            />
                                        </td>

                                        {/* Amount */}
                                        <td className="px-4 py-4 align-top">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="
                                                w-full
                                                rounded-lg
                                                border
                                                border-muted-200
                                                bg-background
                                                px-3
                                                py-2
                                                text-center
                                                text-sm
                                                font-semibold
                                                outline-none
                                                transition
                                                focus:border-secondary-foreground/40
                                                focus:ring-2
                                                focus:ring-secondary-foreground/10
                                            "
                                                value={comp.proposed_amt ?? ""}
                                                onChange={(e) =>
                                                    updateRow(
                                                        "cost_by_components",
                                                        i,
                                                        {
                                                            proposed_amt:
                                                                e.target.value,
                                                        },
                                                    )
                                                }
                                            />
                                        </td>

                                        {/* Remove */}
                                        <td className="px-2 py-4 text-center align-top">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeRow(
                                                        "cost_by_components",
                                                        i,
                                                    )
                                                }
                                                className={`
                                                rounded-md
                                                p-2
                                                text-red-400 hover:text-red-600 transition-colors
                                                ${
                                                    showGroupHover
                                                        ? "opacity-0 group-hover:opacity-100"
                                                        : ""
                                                }
                                            `}
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Totals Section */}
                {payload.cost_by_components.length > 0 && (
                    <div className="border-t border-muted-200 bg-muted-50/70 px-5 py-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            {/* Label */}
                            <div>
                                <h4 className="text-sm font-bold text-muted-700">
                                    Totals by Expense Class
                                </h4>

                                <p className="text-sm text-muted-500 mt-1">
                                    Automatically calculated from all component
                                    allocations
                                </p>
                            </div>

                            {/* Totals Cards */}
                            <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto lg:grid-cols-[repeat(4,130px)]">
                                {(["PS", "MOOE", "CO", "FINEX"] as const).map(
                                    (ec) => {
                                        const total = componentExpenseClassTotals[
                                            ec
                                        ].toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                        });

                                        return (
                                        <div
                                            key={ec}
                                            className="
                                            min-w-0
                                            rounded-lg
                                            border
                                            border-muted-200
                                            bg-background
                                            px-4
                                            py-3
                                            overflow-hidden
                                            "
                                        >
                                            <div className="text-sm font-semibold text-muted-500">
                                                {ec}
                                            </div>

                                            <div
                                                className="mt-1 overflow-auto text-sm font-bold tabular-nums text-secondary-foreground"
                                                title={total}
                                            >
                                                {total}
                                            </div>
                                        </div>
                                        );
                                    },
                                )}

                                {/* Grand Total */}
                                <div
                                    className="
                                    col-span-2
                                    min-w-0
                                    rounded-lg
                                    border
                                    border-secondary-foreground/20
                                    bg-secondary-foreground/5
                                    px-4
                                    py-3
                                    overflow-hidden
                                    sm:col-span-4
                                    lg:col-span-4
                                "
                                >
                                    <div className="text-sm font-semibold text-muted-600">
                                        GRAND TOTAL
                                    </div>

                                    {(() => {
                                        const total = grandTotal.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                        });

                                        return (
                                            <div
                                                className="mt-1 overflow-auto text-sm font-bold tabular-nums text-secondary-foreground"
                                                title={total}
                                            >
                                                {total}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {payload.cost_by_components.length === 0 && (
                    <div className="p-8 text-center text-muted-400 text-sm italic">
                        No component allocations added. Click &quot;+ ADD
                        ALLOCATION&quot; to begin.
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
        <LoadingOverlay show={isLoading} label={submitAction === "draft" ? "Saving proposal..." : "Submitting proposal..."} />
        <form
            onSubmit={handleSubmit}
            className="max-w-5xl mx-auto mt-8 px-4 space-y-8"
        >
            {Object.keys(errors).length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded shadow-sm">
                    <div className="flex items-center mb-2 text-red-800">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        <h3 className="font-bold">
                            Please correct the following:
                        </h3>
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                        {Object.entries(errors).map(([path, message], idx) => (
                            <li key={idx} className="text-red-700 text-sm">
                                {getFriendlyErrorMessage(path, message)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="p-4 bg-muted-50 border-l-4 border-muted-600 rounded-r-lg">
                <h2 className="text-lg font-bold text-muted-800">
                    BP Form {type}:{" "}
                    {payload.is_new === true ? "New Project" : "Expansion"}
                </h2>
            </div>

            <div className="grid grid-cols-2 gap-6 bg-background p-6 rounded-xl border shadow-sm">
                <div className="flex flex-col gap-2">
                    <div className="md:col-span-2">
                        <label className="text-sm font-black uppercase text-muted-400">
                            Project Title
                        </label>
                        <input
                            className={`w-full border-b outline-none py-2 text-lg ${
                                errors.title
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={payload.title}
                            disabled={!payload.is_new}
                            onChange={(e) =>
                                setPayload({
                                    ...payload,
                                    title: e.target.value,
                                })
                            }
                            placeholder="Enter Project Title..."
                        />
                        {errors.title && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.title}
                            </p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-sm font-black uppercase text-muted-400">
                            Description
                        </label>
                        <textarea
                            className={`w-full border p-2 rounded text-sm ${
                                errors.description
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={payload.description}
                            onChange={(e) =>
                                setPayload({
                                    ...payload,
                                    description: e.target.value,
                                })
                            }
                        />
                        {errors.description && (
                            <p className="text-red-500 text-sm">
                                {errors.description}
                            </p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-sm font-black uppercase text-muted-400">
                            Organizational Outcome
                        </label>
                        <textarea
                            className={`w-full border p-2 rounded text-sm ${
                                errors.org_outcome_id
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={payload.org_outcome_id}
                            onChange={(e) =>
                                setPayload({
                                    ...payload,
                                    org_outcome_id: e.target.value,
                                })
                            }
                        />
                        {errors.org_outcome_id && (
                            <p className="text-red-500 text-sm">
                                {errors.org_outcome_id}
                            </p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-sm font-black uppercase text-muted-400">
                            Purpose
                        </label>
                        <textarea
                            className={`w-full border p-2 rounded text-sm ${
                                errors.purpose
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={payload.purpose}
                            onChange={(e) =>
                                setPayload({
                                    ...payload,
                                    purpose: e.target.value,
                                })
                            }
                        />
                        {errors.purpose && (
                            <p className="text-red-500 text-sm">
                                {errors.purpose}
                            </p>
                        )}
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-sm font-black uppercase text-muted-400">
                            Beneficiaries
                        </label>
                        <textarea
                            className={`w-full border p-2 rounded text-sm ${
                                errors.beneficiaries
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={payload.beneficiaries}
                            onChange={(e) =>
                                setPayload({
                                    ...payload,
                                    beneficiaries: e.target.value,
                                })
                            }
                        />
                        {errors.beneficiaries && (
                            <p className="text-red-500 text-sm">
                                {errors.beneficiaries}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-sm font-black uppercase text-muted-400">
                            Priority Rank
                        </label>
                        <input
                            type="number"
                            className={`w-full border-b border-muted-200 py-2 outline-none ${
                                errors.priority_rank
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                            value={payload.priority_rank || ""}
                            onChange={(e) =>
                                setPayload({
                                    ...payload,
                                    priority_rank: parseInt(e.target.value),
                                })
                            }
                        />
                        {errors.priority_rank && (
                            <p className="text-red-500 text-sm">
                                {errors.priority_rank}
                            </p>
                        )}
                    </div>
                    <div className="mb-6 p-4 bg-muted/50 border-l-4 border-muted-400 rounded-r-lg shadow-sm w-full col-span-full">
                        <span className="text-sm font-bold text-muted-500 uppercase tracking-widest">
                            Implementing Agency
                        </span>
                        <h2 className="text-lg font-semibold text-muted-800">
                            {entityName}
                        </h2>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-black text-muted-400 uppercase tracking-widest mb-4">
                            Project Classification
                        </h3>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-muted-300 text-secondary-foreground focus:ring-secondary-foreground-500"
                                checked={payload.is_new}
                                onChange={(e) => {
                                    const isNewProject = e.target.checked;

                                    if (isNewProject) {
                                        setSelectedPapId("");
                                        setPayload((prev) => ({
                                            ...prev,
                                            is_new: true,
                                            existing_pap_id: "",
                                            title: "",
                                            description: "",
                                            org_outcome_id: "",
                                            purpose: "",
                                            beneficiaries: "",
                                            is_infrastructure: false,
                                            for_ict: false,
                                        }));
                                        return;
                                    }

                                    updateRow("is_new", undefined, false);
                                }}
                            />
                            <span className="text-sm font-medium text-muted-700 group-hover:text-secondary-foreground transition-colors">
                                New Project
                            </span>
                        </label>
                        {!hasExistingPaps && (
                            <p className="text-sm text-muted-500">
                                No existing PAPs available. Proposal is locked to New Project.
                            </p>
                        )}
                        {payload.is_new === false && (
                            <div>
                                <label className="text-sm font-black uppercase text-muted-400">
                                    Existing PAP
                                </label>

                                <SearchableComboboxField
                                    items={availablePaps.map((pap) => ({
                                        value: pap.id,
                                        label: pap.title,
                                    }))}
                                    value={selectedPapId}
                                    placeholder="Select Existing PAP"
                                    searchPlaceholder="Search PAP"
                                    emptyText="No PAPs found."
                                    onValueChange={(value) => {
                                        setSelectedPapId(value);

                                        const selectedPap = availablePaps.find(
                                            (p) => p.id === value,
                                        );

                                        if (selectedPap) {
                                            setPayload((prev) => ({
                                                ...prev,
                                                title: selectedPap.title,
                                                description: selectedPap.description ?? "",
                                                org_outcome_id: selectedPap.org_outcome_id,
                                                purpose: selectedPap.purpose,
                                                beneficiaries: selectedPap.beneficiaries,
                                                is_infrastructure: selectedPap.is_infrastructure ?? false,
                                                for_ict: selectedPap.for_ict ?? false,
                                                existing_pap_id: value,
                                            }));
                                        }
                                    }}
                                />

                                {!selectedPapId && (
                                    <p className="text-red-500 text-sm mt-1">
                                        Please select an existing PAP.
                                    </p>
                                )}
                            </div>
                        )}
                        {payload.is_new == true && (
                            <label className="ml-6 flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-muted-300 text-secondary-foreground focus:ring-secondary-foreground-500"
                                    checked={payload.myca_issuance ?? false}
                                    onChange={(e) =>
                                        updateRow(
                                            "myca_issuance",
                                            undefined,
                                            e.target.checked,
                                        )
                                    }
                                />
                                <span className="text-sm font-medium text-muted-700 group-hover:text-secondary-foreground transition-colors">
                                    For MYCA Issuance
                                </span>
                            </label>
                        )}

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-muted-300 text-secondary-foreground focus:ring-secondary-foreground-500"
                                checked={payload.is_infrastructure}
                                onChange={(e) =>
                                    updateRow(
                                        "is_infrastructure",
                                        undefined,
                                        e.target.checked,
                                    )
                                }
                            />
                            <span className="text-sm font-medium text-muted-700 group-hover:text-secondary-foreground transition-colors">
                                Infrastructure Project
                            </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-5 h-5 rounded border-muted-300 text-secondary-foreground focus:ring-secondary-foreground-500"
                                checked={payload.for_ict ?? false}
                                onChange={(e) =>
                                    updateRow(
                                        "for_ict",
                                        undefined,
                                        e.target.checked,
                                    )
                                }
                            />
                            <span className="text-sm font-medium text-muted-700 group-hover:text-secondary-foreground transition-colors">
                                Information & Communications Technology (ICT)
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="bg-background rounded-xl border shadow-sm overflow-hidden mb-6">
                <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                    <h3 className="text-sm font-black text-muted-500 uppercase tracking-widest">
                        PAP Prerequisites
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <div className="max-h-[520px] overflow-auto">
                        <table className="w-full text-left border-spacing-0 divide-y">
                            <thead className="sticky top-0 bg-muted z-20 shadow-sm">
                                <tr className="bg-background border-b">
                                    <th
                                        rowSpan={2}
                                        className="py-4 px-4 text-sm font-bold text-muted-700 uppercase border-r w-1/3 text-center"
                                    >
                                        Approving Authorities / Supporting
                                        Documents
                                    </th>
                                    <th
                                        colSpan={3}
                                        className="py-2 text-sm font-bold text-muted-700 uppercase border-b text-center"
                                    >
                                        Reviewed/Approved
                                    </th>
                                    <th
                                        rowSpan={2}
                                        className="py-4 px-4 text-sm font-bold text-muted-700 uppercase border-l text-center"
                                    >
                                        Remarks
                                    </th>
                                    <th rowSpan={2}></th>
                                </tr>
                                <tr className="bg-background border-b">
                                    <th className="py-2 text-sm font-bold text-muted-500 uppercase text-center border-r w-20">
                                        Yes
                                    </th>
                                    <th className="py-2 text-sm font-bold text-muted-500 uppercase text-center border-r w-20">
                                        No
                                    </th>
                                    <th className="py-2 text-sm font-bold text-muted-500 uppercase text-center w-28">
                                        Not Applicable
                                    </th>
                                </tr>
                            </thead>

                            {/* Section 1: Approving Authorities */}
                            <tbody>
                                <tr className="border border-b">
                                    <td
                                        colSpan={4}
                                        className="py-2 px-4 text-sm font-black text-muted-600 uppercase italic"
                                    >
                                        Approving Authorities
                                    </td>
                                    <td
                                        className="flex flex-row-reverse"
                                        colSpan={2}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                addRow("pap_prerequisites", {
                                                    name: "",
                                                    type: "authority",
                                                    status: "True",
                                                    remarks: "",
                                                })
                                            }
                                            className="text-secondary-foreground text-sm font-bold hover:underline py-2 px-4"
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
                                                placeholder="Approver"
                                                index={i}
                                                updateRow={updateRow}
                                                removeRow={removeRow}
                                            />
                                        ),
                                )}
                            </tbody>

                            {/* Section 2: Supporting Documents */}
                            <tbody>
                                <tr className="bg-muted-50/50 border-b border-t">
                                    <td
                                        colSpan={4}
                                        className="py-2 px-4 text-sm font-black text-muted-600 uppercase italic border-b border-t"
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
                                                    status: "True",
                                                    remarks: "",
                                                })
                                            }
                                            className="text-secondary-foreground text-sm font-bold hover:underline py-2 px-4"
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
                                                placeholder="Document"
                                                index={i}
                                                updateRow={updateRow}
                                                removeRow={removeRow}
                                            />
                                        ),
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div className="space-y-2">
                <div
                    className={`shadow-sm overflow-hidden bg-background ${
                        errors.cost_by_components
                            ? "border-red-500 bg-red-50"
                            : "border-muted-200"
                    }`}
                >
                    <CollapsibleTableSection
                        section="cost_by_components"
                        title={
                            payload.type === "202"
                                ? "Cost by Components (BP 202)"
                                : "Cost by Components (BP 203)"
                        }
                        subtitle="Define allocation details across components"
                        collapsed={collapsedSections.cost_by_components}
                        onToggle={() => toggleSection("cost_by_components")}
                        actions={
                            <button
                                type="button"
                                onClick={addCostComponent}
                                className="rounded-lg bg-secondary-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
                            >
                                + Add Component
                            </button>
                        }
                        summary={
                            <div className="text-sm text-muted-500 italic">
                                {payload.cost_by_components.length} components
                                configured.
                            </div>
                        }
                    >
                        {payload.type === "202" ? (
                            renderCostComponentAllocationTable(true)
                        ) : (
                            <div className="max-h-[520px] overflow-auto p-0">
                                {/* Added table-fixed to make column width definitions strict and predictable */}
                                <table className="w-full border-spacing-0 table-fixed">
                                    <thead className="sticky top-0 z-20 bg-background border-b border-muted-200">
                                        <tr>
                                            <th className="bg-muted-50 px-4 py-4 text-left text-sm font-bold text-muted-600 w-[180px]">
                                                Item Catalog
                                            </th>

                                            <th className="bg-muted-50 px-4 py-4 text-left text-sm font-bold text-muted-600 w-[180px]">
                                                Fund Source
                                            </th>

                                            <th className="bg-muted-50 px-4 py-4 text-left text-sm font-bold text-muted-600 w-[140px]">
                                                Description
                                            </th>

                                            <th className="bg-muted-50 px-3 py-4 text-center text-sm font-bold text-muted-600 w-[140px]">
                                                Fund Method
                                            </th>

                                            <th className="bg-muted-50 px-3 py-4 text-center text-sm font-bold text-muted-600 w-[160px]">
                                                Total
                                            </th>

                                            <th className="bg-muted-50 w-12" />
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {payload.cost_by_components.map(
                                            (comp, i) => {
                                                const selectedItem =
                                                    getSelectedItemCatalog(
                                                        comp.item_catalog_id,
                                                    );
                                                const expenseClass =
                                                    selectedItem?.expense_class;

                                                const lpCashRow =
                                                    comp.costs.find(
                                                        (c) =>
                                                            c.fund_category ===
                                                                "LP" &&
                                                            normalizeBp203FundMethod(
                                                                c.fund_method,
                                                            ) === "cash",
                                                    );
                                                const lpNonCashRow =
                                                    comp.costs.find(
                                                        (c) =>
                                                            c.fund_category ===
                                                                "LP" &&
                                                            normalizeBp203FundMethod(
                                                                c.fund_method,
                                                            ) === "non_cash",
                                                    );
                                                const gopRow =
                                                    comp.costs.find(
                                                        (c) =>
                                                            c.fund_category ===
                                                            "GOP",
                                                    );

                                                const lpCash = Number(
                                                    lpCashRow?.amount || 0,
                                                );
                                                const lpNonCash = Number(
                                                    lpNonCashRow?.amount || 0,
                                                );
                                                const gop = Number(
                                                    gopRow?.amount || 0,
                                                );

                                                const storedCategory =
                                                    gop > 0 &&
                                                    lpCash === 0 &&
                                                    lpNonCash === 0
                                                        ? "GOP"
                                                        : "LP";
                                                const storedMethod =
                                                    lpNonCash > 0 &&
                                                    lpCash === 0
                                                        ? "non_cash"
                                                        : "cash";
                                                const selectedCategory =
                                                    bp203Selections[i]
                                                        ?.category ??
                                                    storedCategory;
                                                const selectedMethod =
                                                    bp203Selections[i]
                                                        ?.method ??
                                                    storedMethod;

                                                // Calculate dynamic total matching the user configuration
                                                const rowTotal =
                                                    selectedCategory === "GOP"
                                                        ? gop
                                                        : selectedMethod ===
                                                            "cash"
                                                          ? lpCash
                                                          : lpNonCash;
                                                const activeValue =
                                                    selectedCategory === "GOP"
                                                        ? gop
                                                        : selectedMethod ===
                                                            "cash"
                                                          ? lpCash
                                                          : lpNonCash;

                                                return (
                                                    <tr
                                                        key={i}
                                                        className="border-b border-muted-100 hover:bg-muted-50/50 transition-colors group"
                                                    >
                                                        {/* Item Catalog Column */}
                                                        <td className="px-4 py-4 align-top w-[180px] max-w-[180px] overflow-hidden">
                                                            <SearchableComboboxField
                                                                items={
                                                                    itemCatalogOptions
                                                                }
                                                                value={
                                                                    comp.item_catalog_id ??
                                                                    ""
                                                                }
                                                                placeholder="Select item catalog"
                                                                searchPlaceholder="Search line items"
                                                                emptyText="No line items found."
                                                                onValueChange={(
                                                                    value,
                                                                ) =>
                                                                    updateCostComponentItem(
                                                                        i,
                                                                        value,
                                                                    )
                                                                }
                                                            />
                                                        </td>

                                                        {/* Funding Source Column */}
                                                        <td className="px-4 py-4 align-top w-[180px] max-w-[180px] overflow-hidden">
                                                            <SearchableComboboxField
                                                                items={
                                                                    fundingSourceOptions
                                                                }
                                                                value={
                                                                    comp.fund_code ??
                                                                    ""
                                                                }
                                                                placeholder="Select fund source"
                                                                searchPlaceholder="Search fund sources"
                                                                emptyText="No fund sources found."
                                                                onValueChange={(
                                                                    value,
                                                                ) =>
                                                                    updateRow(
                                                                        "cost_by_components",
                                                                        i,
                                                                        {
                                                                            fund_code:
                                                                                value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                        </td>

                                                        {/* Description Column */}
                                                        <td className="px-4 py-4 align-top">
                                                            <textarea
                                                                className="min-h-[88px] w-full resize-none rounded-lg border border-muted-200 bg-background px-3 py-2 text-sm outline-none transition focus:border-secondary-foreground/40 focus:ring-2 focus:ring-secondary-foreground/10"
                                                                placeholder="Optional description"
                                                                value={
                                                                    comp.specific_description ??
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    updateRow(
                                                                        "cost_by_components",
                                                                        i,
                                                                        {
                                                                            specific_description:
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                        </td>

                                                        {/* Dynamic Funding Type Select Dropdowns Column */}
                                                        <td className="px-3 py-4 align-top w-[160px]">
                                                            <div className="flex flex-col gap-2">
                                                                {/* Main Category Select */}
                                                                <select
                                                                    className="w-full rounded-lg border border-muted-200 bg-background px-2 py-1.5 text-sm outline-none transition focus:border-secondary-foreground/40"
                                                                    value={
                                                                        selectedCategory
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) => {
                                                                        if (
                                                                            !expenseClass
                                                                        )
                                                                            return;
                                                                        const nextCat =
                                                                            e
                                                                                .target
                                                                                .value as Bp203FundCategory;
                                                                        setBp203Selections(
                                                                            (
                                                                                prev,
                                                                            ) => ({
                                                                                ...prev,
                                                                                [i]: {
                                                                                    category:
                                                                                        nextCat,
                                                                                    method:
                                                                                        prev[
                                                                                            i
                                                                                        ]
                                                                                            ?.method ??
                                                                                        selectedMethod,
                                                                                },
                                                                            }),
                                                                        );

                                                                        if (
                                                                            nextCat ===
                                                                            "GOP"
                                                                        ) {
                                                                            // Zero out old LP targets, preserve current amount over to GOP
                                                                            handleMatrixChange203(
                                                                                i,
                                                                                expenseClass,
                                                                                "LP",
                                                                                0,
                                                                                "cost_by_components",
                                                                                "cash",
                                                                            );
                                                                            handleMatrixChange203(
                                                                                i,
                                                                                expenseClass,
                                                                                "LP",
                                                                                0,
                                                                                "cost_by_components",
                                                                                "non_cash",
                                                                            );
                                                                            handleMatrixChange203(
                                                                                i,
                                                                                expenseClass,
                                                                                "GOP",
                                                                                activeValue ||
                                                                                    0,
                                                                                "cost_by_components",
                                                                            );
                                                                        } else {
                                                                            // Zero out GOP, shift value into current fallback LP target split
                                                                            handleMatrixChange203(
                                                                                i,
                                                                                expenseClass,
                                                                                "GOP",
                                                                                0,
                                                                                "cost_by_components",
                                                                            );
                                                                            handleMatrixChange203(
                                                                                i,
                                                                                expenseClass,
                                                                                "LP",
                                                                                activeValue ||
                                                                                    0,
                                                                                "cost_by_components",
                                                                                selectedMethod,
                                                                            );
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="LP">
                                                                        LP
                                                                    </option>
                                                                    <option value="GOP">
                                                                        GOP
                                                                    </option>
                                                                </select>

                                                                {/* Secondary Method Select (Only rendered if Category is LP) */}
                                                                {selectedCategory ===
                                                                    "LP" && (
                                                                    <select
                                                                        className="w-full rounded-lg border border-muted-200 bg-background px-2 py-1.5 text-xs font-medium text-muted-600 outline-none transition focus:border-secondary-foreground/40 state-anim"
                                                                        value={
                                                                            selectedMethod
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) => {
                                                                            if (
                                                                                !expenseClass
                                                                            )
                                                                                return;
                                                                            const nextMethod =
                                                                                e
                                                                                    .target
                                                                                    .value as Bp203FundMethod;
                                                                            setBp203Selections(
                                                                                (
                                                                                    prev,
                                                                                ) => ({
                                                                                    ...prev,
                                                                                    [i]: {
                                                                                        category:
                                                                                            selectedCategory,
                                                                                        method: nextMethod,
                                                                                    },
                                                                                }),
                                                                            );
                                                                            // Swap amounts between cash and non_cash variables safely
                                                                            handleMatrixChange203(
                                                                                i,
                                                                                expenseClass,
                                                                                "LP",
                                                                                0,
                                                                                "cost_by_components",
                                                                                selectedMethod,
                                                                            );
                                                                            handleMatrixChange203(
                                                                                i,
                                                                                expenseClass,
                                                                                "LP",
                                                                                activeValue ||
                                                                                    0,
                                                                                "cost_by_components",
                                                                                nextMethod,
                                                                            );
                                                                        }}
                                                                    >
                                                                        <option value="cash">
                                                                            Cash
                                                                        </option>
                                                                        <option value="non_cash">
                                                                            Non-Cash
                                                                        </option>
                                                                    </select>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Amount Numeric Input Box */}
                                                        <td className="px-3 py-4 align-top w-[150px]">
                                                            <input
                                                                type="number"
                                                                className="w-full rounded-lg border border-muted-200 px-3 py-2 text-center text-sm outline-none focus:border-secondary-foreground/40"
                                                                value={
                                                                    activeValue ||
                                                                    ""
                                                                }
                                                                placeholder="0.00"
                                                                onChange={(
                                                                    e,
                                                                ) => {
                                                                    if (
                                                                        !expenseClass
                                                                    )
                                                                        return;
                                                                    const val =
                                                                        e.target
                                                                            .valueAsNumber ||
                                                                        0;

                                                                    handleMatrixChange203(
                                                                        i,
                                                                        expenseClass,
                                                                        selectedCategory,
                                                                        val,
                                                                        "cost_by_components",
                                                                        selectedCategory ===
                                                                            "LP"
                                                                            ? selectedMethod
                                                                            : undefined,
                                                                    );
                                                                }}
                                                            />
                                                        </td>

                                                        {/* Row Total Display */}
                                                        <td className="px-3 py-4 align-top text-center min-w-[120px]">
                                                            <div className="text-sm font-bold text-secondary-foreground pt-2">
                                                                {rowTotal.toLocaleString(
                                                                    undefined,
                                                                    {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 2,
                                                                    },
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Action Delete Button */}
                                                        <td className="px-2 py-4 text-center align-top">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    removeRow(
                                                                        "cost_by_components",
                                                                        i,
                                                                    )
                                                                }
                                                                className="rounded-md p-2 text-red-400 hover:text-red-600 transition-colors"
                                                            >
                                                                ✕
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            },
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CollapsibleTableSection>
                </div>

                {getErrorsForPath("cost_by_components").length > 0 && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-lg mb-4">
                        {getErrorsForPath("cost_by_components").map(
                            (msg, i) => (
                                <p
                                    key={i}
                                    className="text-sm text-red-600 font-semibold flex items-center gap-1"
                                >
                                    <span className="w-1 h-1 bg-red-600 rounded-full" />{" "}
                                    {msg}
                                </p>
                            ),
                        )}
                    </div>
                )}
            </div>

            {type === "202" && (
                <div className="space-y-8">
                    <div className="space-y-2">
                        <div
                            className={`bg-background shadow-sm overflow-hidden ${
                                errors.local_locations
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                        >
                            <CollapsibleTableSection
                                section="local_locations"
                                title="Local Locations"
                                subtitle="Add geographical target locations and assign cost breakdowns"
                                collapsed={collapsedSections.local_locations}
                                onToggle={() =>
                                    toggleSection("local_locations")
                                }
                                actions={
                                    <button
                                        type="button"
                                        onClick={() =>
                                            addRow("local_locations", {
                                                location: "",
                                                costs: [],
                                            })
                                        }
                                        className="rounded-lg
                                        bg-secondary-foreground
                                        px-4
                                        py-2
                                        text-sm
                                        font-semibold
                                        text-background
                                        transition
                                        hover:opacity-90"
                                    >
                                        + Add Location
                                    </button>
                                }
                                summary={
                                    <div className="text-sm text-muted-500 italic">
                                        {payload.local_locations.length}{" "}
                                        locations added.
                                    </div>
                                }
                            >
                                {/* Wrap your original locations table / mapping layout here */}
                                <div
                                    className={` shadow-sm overflow-hidden ${
                                        errors.local_locations
                                            ? "border-red-500 bg-red-50"
                                            : "border-muted-200 bg-background"
                                    }`}
                                >
                                    <div className="max-h-[520px] overflow-auto p-0">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-muted-100">
                                                    <th className="py-3 px-4 text-sm font-black text-muted-400 uppercase w-1/3">
                                                        Location
                                                    </th>
                                                    <th className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center w-1/6 text-secondary-foreground-500 bg-secondary-foreground-50/30">
                                                        PS
                                                    </th>
                                                    <th className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center w-1/6 bg-muted-50/30">
                                                        MOOE
                                                    </th>
                                                    <th className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center w-1/6 bg-muted-50/30">
                                                        CO
                                                    </th>
                                                    <th className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center w-1/6 bg-muted-50/30">
                                                        FINEX
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-muted-50">
                                                {payload.local_locations.map(
                                                    (item, i) => (
                                                        <tr key={i}>
                                                            <td className="py-3 px-4">
                                                                <input
                                                                    className="w-full bg-transparent font-medium text-muted-700 outline-none"
                                                                    placeholder="Region/Province"
                                                                    value={
                                                                        item.location
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        updateRow(
                                                                            "local_locations",
                                                                            i,
                                                                            {
                                                                                location:
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                            },
                                                                        )
                                                                    }
                                                                />
                                                            </td>
                                                            {(
                                                                [
                                                                    "PS",
                                                                    "MOOE",
                                                                    "CO",
                                                                    "FINEX",
                                                                ] as const
                                                            ).map(
                                                                (itemClass) => (
                                                                    <td
                                                                        key={
                                                                            itemClass
                                                                        }
                                                                        className="py-2 px-2"
                                                                    >
                                                                        <input
                                                                            type="number"
                                                                            className="w-full bg-transparent text-center outline-none text-sm"
                                                                            placeholder="0"
                                                                            value={
                                                                                item.costs.find(
                                                                                    (
                                                                                        c,
                                                                                    ) =>
                                                                                        c.expense_class ===
                                                                                        itemClass,
                                                                                )
                                                                                    ?.amount ??
                                                                                ""
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                handleMatrixChange(
                                                                                    "local_locations",
                                                                                    i,
                                                                                    itemClass,
                                                                                    e
                                                                                        .target
                                                                                        .valueAsNumber ||
                                                                                        0,
                                                                                )
                                                                            }
                                                                        />
                                                                    </td>
                                                                ),
                                                            )}
                                                            <td className="py-3 px-2 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        removeRow(
                                                                            "local_locations",
                                                                            i,
                                                                        )
                                                                    }
                                                                    className="text-red-400 hover:text-red-600"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {payload.local_locations.length === 0 && (
                                        <div className="p-8 text-center text-muted-400 text-sm italic">
                                            No components added. Click &quot;+
                                            ADD LOCATION&quot; to begin.
                                        </div>
                                    )}
                                </div>
                            </CollapsibleTableSection>
                        </div>
                        {getErrorsForPath("local_locations").length > 0 && (
                            <div className="bg-red-50 border border-red-100 p-3 rounded-lg mb-4">
                                {getErrorsForPath("local_locations").map(
                                    (msg, i) => (
                                        <p
                                            key={i}
                                            className="text-sm text-red-600 font-semibold flex items-center gap-1"
                                        >
                                            <span className="w-1 h-1 bg-red-600 rounded-full" />{" "}
                                            {msg}
                                        </p>
                                    ),
                                )}
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <div
                            className={`bg-background shadow-sm overflow-hidden ${
                                errors.local_financial_attributions
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                        >
                            <CollapsibleTableSection
                                section="local_financial_attributions"
                                title="Local Financial Attributions"
                                subtitle="Identify climate change or specific statutory program attributions"
                                collapsed={
                                    collapsedSections.local_financial_attributions
                                }
                                onToggle={() =>
                                    toggleSection(
                                        "local_financial_attributions",
                                    )
                                }
                                actions={
                                    <button
                                        type="button"
                                        onClick={() =>
                                            addRow(
                                                "local_financial_attributions",
                                                {
                                                    description: "",
                                                    attribution_costs: [],
                                                },
                                            )
                                        }
                                        className="rounded-lg bg-secondary-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
                                    >
                                        + Add Attribution
                                    </button>
                                }
                                summary={
                                    <div className="text-sm text-muted-500 italic">
                                        {
                                            payload.local_financial_attributions
                                                .length
                                        }{" "}
                                        attributions added.
                                    </div>
                                }
                            >
                                {/* Wrap your original local financial attributions table implementation here */}
                                <div
                                    className={`bg-background shadow-sm overflow-hidden ${
                                        errors.local_financial_attributions
                                            ? "border-red-500 bg-red-50"
                                            : "border-muted-200"
                                    }`}
                                >
                                    <div className="max-h-[520px] overflow-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b">
                                                    <th
                                                        rowSpan={2}
                                                        className="py-4 px-4 text-sm font-bold text-slate-700 uppercase border-r w-1/4 text-center"
                                                    >
                                                        PAP (A)
                                                    </th>
                                                    <th
                                                        colSpan={3}
                                                        className="py-2 text-sm font-bold text-slate-700 uppercase border-b border-r text-center"
                                                    >
                                                        FY{" "}
                                                        {payload.proposal_year}{" "}
                                                        (B)
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-4 px-2 text-sm font-bold text-slate-700 uppercase border-r text-center"
                                                    >
                                                        FY{" "}
                                                        {payload.proposal_year +
                                                            1}{" "}
                                                        Tier 1 (C)
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-4 px-2 text-sm font-bold text-slate-700 uppercase text-center"
                                                    >
                                                        FY{" "}
                                                        {payload.proposal_year +
                                                            2}{" "}
                                                        Tier 1 (D)
                                                    </th>
                                                </tr>
                                                <tr className="border-b">
                                                    <th className="py-2 text-sm font-bold text-slate-500 uppercase text-center border-r w-24">
                                                        Tier 1
                                                    </th>
                                                    <th className="py-2 text-sm font-bold text-slate-500 uppercase text-center border-r w-24">
                                                        Tier 2
                                                    </th>
                                                    <th className="py-2 text-sm font-bold text-slate-500 uppercase text-center border-r w-24">
                                                        Total
                                                    </th>
                                                </tr>
                                            </thead>

                                            {payload.local_financial_attributions.map(
                                                (attr, attrIdx) => {
                                                    // Column configuration for total calculations
                                                    const cols = [
                                                        {
                                                            year: payload.proposal_year,
                                                            tier: 1,
                                                        },
                                                        {
                                                            year: payload.proposal_year,
                                                            tier: 2,
                                                        },
                                                        {
                                                            isTotal: true,
                                                            year: payload.proposal_year,
                                                        }, // Visual Total Column
                                                        {
                                                            year:
                                                                payload.proposal_year +
                                                                1,
                                                            tier: 1,
                                                        },
                                                        {
                                                            year:
                                                                payload.proposal_year +
                                                                2,
                                                            tier: 1,
                                                        },
                                                    ];

                                                    return (
                                                        <tbody
                                                            key={attrIdx}
                                                            className="border-b-2 border-chart-5/50"
                                                        >
                                                            <tr className="border-chart-5/20 font-bold border-b divide-x">
                                                                <td className="py-3 px-4 flex flex-row gap-4">
                                                                    <input
                                                                        className="w-full font-bold text-sm text-slate-800 outline-none bg-transparent placeholder:font-normal"
                                                                        placeholder="Enter PAP Description..."
                                                                        value={
                                                                            attr.description
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateRow(
                                                                                "local_financial_attributions",
                                                                                attrIdx,
                                                                                {
                                                                                    description:
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                },
                                                                            )
                                                                        }
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            removeRow(
                                                                                "local_financial_attributions",
                                                                                attrIdx,
                                                                            )
                                                                        }
                                                                        className="text-red-400 hover:text-red-600"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </td>
                                                                {cols.map(
                                                                    (
                                                                        col,
                                                                        colIdx,
                                                                    ) => {
                                                                        // Calculate total for this specific column (Year/Tier) across all expense classes
                                                                        const colTotal =
                                                                            (
                                                                                [
                                                                                    "PS",
                                                                                    "MOOE",
                                                                                    "CO",
                                                                                    "FINEX",
                                                                                ] as const
                                                                            ).reduce(
                                                                                (
                                                                                    sum,
                                                                                    ec,
                                                                                ) => {
                                                                                    if (
                                                                                        col.isTotal
                                                                                    ) {
                                                                                        const t1 =
                                                                                            Number(
                                                                                                attr.attribution_costs
                                                                                                    .find(
                                                                                                        (
                                                                                                            c,
                                                                                                        ) =>
                                                                                                            c.year ===
                                                                                                                col.year &&
                                                                                                            c.tier ===
                                                                                                                1,
                                                                                                    )
                                                                                                    ?.costs?.find(
                                                                                                        (
                                                                                                            e,
                                                                                                        ) =>
                                                                                                            e.expense_class ===
                                                                                                            ec,
                                                                                                    )
                                                                                                    ?.amount ||
                                                                                                    0,
                                                                                            );
                                                                                        const t2 =
                                                                                            Number(
                                                                                                attr.attribution_costs
                                                                                                    .find(
                                                                                                        (
                                                                                                            c,
                                                                                                        ) =>
                                                                                                            c.year ===
                                                                                                                col.year &&
                                                                                                            c.tier ===
                                                                                                                2,
                                                                                                    )
                                                                                                    ?.costs?.find(
                                                                                                        (
                                                                                                            e,
                                                                                                        ) =>
                                                                                                            e.expense_class ===
                                                                                                            ec,
                                                                                                    ) // Added ?. here
                                                                                                    ?.amount ||
                                                                                                    0,
                                                                                            );
                                                                                        return (
                                                                                            sum +
                                                                                            (t1 +
                                                                                                t2)
                                                                                        );
                                                                                    }
                                                                                    return (
                                                                                        sum +
                                                                                        Number(
                                                                                            attr.attribution_costs
                                                                                                .find(
                                                                                                    (
                                                                                                        c,
                                                                                                    ) =>
                                                                                                        c.year ===
                                                                                                            col.year &&
                                                                                                        c.tier ===
                                                                                                            col.tier,
                                                                                                )
                                                                                                ?.costs.find(
                                                                                                    (
                                                                                                        e,
                                                                                                    ) =>
                                                                                                        e.expense_class ===
                                                                                                        ec,
                                                                                                )
                                                                                                ?.amount ||
                                                                                                0,
                                                                                        )
                                                                                    );
                                                                                },
                                                                                0,
                                                                            );

                                                                        return (
                                                                            <td
                                                                                key={
                                                                                    colIdx
                                                                                }
                                                                                className={`px-2 text-center text-sm ${col.isTotal ? "bg-slate-100/50" : ""}`}
                                                                            >
                                                                                {colTotal >
                                                                                0
                                                                                    ? colTotal.toLocaleString()
                                                                                    : "-"}
                                                                            </td>
                                                                        );
                                                                    },
                                                                )}
                                                            </tr>

                                                            {/* 2. THE EXPENSE CLASS ROWS (Detailed Entry) */}
                                                            {(
                                                                [
                                                                    "PS",
                                                                    "MOOE",
                                                                    "CO",
                                                                    "FINEX",
                                                                ] as const
                                                            ).map(
                                                                (expClass) => (
                                                                    <tr
                                                                        key={
                                                                            expClass
                                                                        }
                                                                        className="hover:bg-slate-50/30 divide-x"
                                                                    >
                                                                        <td className="py-2 px-8 text-sm text-slate-500 font-medium">
                                                                            {
                                                                                expClass
                                                                            }
                                                                        </td>
                                                                        {cols.map(
                                                                            (
                                                                                col,
                                                                                colIdx,
                                                                            ) => {
                                                                                if (
                                                                                    col.isTotal
                                                                                ) {
                                                                                    const t1 =
                                                                                        Number(
                                                                                            attr.attribution_costs
                                                                                                .find(
                                                                                                    (
                                                                                                        c,
                                                                                                    ) =>
                                                                                                        c.year ===
                                                                                                            col.year &&
                                                                                                        c.tier ===
                                                                                                            1,
                                                                                                )
                                                                                                ?.costs?.find(
                                                                                                    (
                                                                                                        e,
                                                                                                    ) =>
                                                                                                        e.expense_class ===
                                                                                                        expClass,
                                                                                                ) // Added ?. here
                                                                                                ?.amount ||
                                                                                                0,
                                                                                        );
                                                                                    const t2 =
                                                                                        Number(
                                                                                            attr.attribution_costs
                                                                                                .find(
                                                                                                    (
                                                                                                        c,
                                                                                                    ) =>
                                                                                                        c.year ===
                                                                                                            col.year &&
                                                                                                        c.tier ===
                                                                                                            2,
                                                                                                )
                                                                                                ?.costs?.find(
                                                                                                    (
                                                                                                        e,
                                                                                                    ) =>
                                                                                                        e.expense_class ===
                                                                                                        expClass,
                                                                                                ) // Added ?. here
                                                                                                ?.amount ||
                                                                                                0,
                                                                                        );
                                                                                    return (
                                                                                        <td
                                                                                            key={
                                                                                                colIdx
                                                                                            }
                                                                                            className="bg-slate-50/50 text-center px-2 text-sm font-bold text-slate-400"
                                                                                        >
                                                                                            {(
                                                                                                t1 +
                                                                                                t2
                                                                                            ).toLocaleString()}
                                                                                        </td>
                                                                                    );
                                                                                }

                                                                                return (
                                                                                    <td
                                                                                        key={
                                                                                            colIdx
                                                                                        }
                                                                                        className="px-2 "
                                                                                    >
                                                                                        <input
                                                                                            type="number"
                                                                                            className="w-full text-center bg-transparent outline-none text-sm py-1 disabled:cursor-not-allowed disabled:text-slate-400"
                                                                                            placeholder="0"
                                                                                            disabled={
                                                                                                payload.is_new &&
                                                                                                col.year === payload.proposal_year &&
                                                                                                col.tier === 1
                                                                                            }
                                                                                            value={
                                                                                                attr.attribution_costs
                                                                                                    .find(
                                                                                                        (
                                                                                                            c,
                                                                                                        ) =>
                                                                                                            c.year ===
                                                                                                                col.year &&
                                                                                                            c.tier ===
                                                                                                                col.tier,
                                                                                                    )
                                                                                                    ?.costs?.find(
                                                                                                        (
                                                                                                            e,
                                                                                                        ) =>
                                                                                                            e.expense_class ===
                                                                                                            expClass,
                                                                                                    ) // Added ?. here
                                                                                                    ?.amount ??
                                                                                                ""
                                                                                            }
                                                                                            onChange={(
                                                                                                e,
                                                                                            ) => {
                                                                                                if (
                                                                                                    payload.is_new &&
                                                                                                    col.year === payload.proposal_year &&
                                                                                                    col.tier === 1
                                                                                                ) {
                                                                                                    return;
                                                                                                }

                                                                                                const newAttrCosts =
                                                                                                    [
                                                                                                        ...attr.attribution_costs,
                                                                                                    ];
                                                                                                let yearTierEntry =
                                                                                                    newAttrCosts.find(
                                                                                                        (
                                                                                                            c,
                                                                                                        ) =>
                                                                                                            c.year ===
                                                                                                                col.year &&
                                                                                                            c.tier ===
                                                                                                                col.tier,
                                                                                                    );
                                                                                                if (
                                                                                                    !yearTierEntry
                                                                                                ) {
                                                                                                    yearTierEntry =
                                                                                                        {
                                                                                                            year: col.year!,
                                                                                                            tier: col.tier!,
                                                                                                            costs: [],
                                                                                                        };
                                                                                                    newAttrCosts.push(
                                                                                                        yearTierEntry,
                                                                                                    );
                                                                                                }
                                                                                                const currentCosts =
                                                                                                    [
                                                                                                        ...yearTierEntry.costs,
                                                                                                    ];
                                                                                                const costIdx =
                                                                                                    currentCosts.findIndex(
                                                                                                        (
                                                                                                            c,
                                                                                                        ) =>
                                                                                                            c.expense_class ===
                                                                                                            expClass,
                                                                                                    );
                                                                                                if (
                                                                                                    costIdx >
                                                                                                    -1
                                                                                                )
                                                                                                    currentCosts[
                                                                                                        costIdx
                                                                                                    ].amount =
                                                                                                        e
                                                                                                            .target
                                                                                                            .valueAsNumber ||
                                                                                                        0;
                                                                                                else
                                                                                                    currentCosts.push(
                                                                                                        {
                                                                                                            expense_class:
                                                                                                                expClass,
                                                                                                            amount:
                                                                                                                e
                                                                                                                    .target
                                                                                                                    .valueAsNumber ||
                                                                                                                0,
                                                                                                            currency:
                                                                                                                "PHP",
                                                                                                        },
                                                                                                    );
                                                                                                yearTierEntry.costs =
                                                                                                    currentCosts;
                                                                                                updateRow(
                                                                                                    "local_financial_attributions",
                                                                                                    attrIdx,
                                                                                                    {
                                                                                                        attribution_costs:
                                                                                                            newAttrCosts,
                                                                                                    },
                                                                                                );
                                                                                            }}
                                                                                        />
                                                                                    </td>
                                                                                );
                                                                            },
                                                                        )}
                                                                    </tr>
                                                                ),
                                                            )}
                                                        </tbody>
                                                    );
                                                },
                                            )}
                                        </table>

                                        {payload.local_financial_attributions
                                            .length === 0 && (
                                            <div className="p-8 text-center text-muted-400 text-sm italic">
                                                No Local Financial Attributions
                                                added. Click &quot;+ ADD
                                                ATTRIBUTION&quot; to begin.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CollapsibleTableSection>
                        </div>
                        {getErrorsForPath("local_financial_attributions")
                            .length > 0 && (
                            <div className="bg-red-50 border border-red-100 p-3 rounded-lg mb-4">
                                {getErrorsForPath(
                                    "local_financial_attributions",
                                ).map((msg, i) => (
                                    <p
                                        key={i}
                                        className="text-sm text-red-600 font-semibold flex items-center gap-1"
                                    >
                                        <span className="w-1 h-1 bg-red-600 rounded-full" />{" "}
                                        {msg}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>

                    {payload.is_infrastructure && (
                        <div className="space-y-2">
                            <div
                                className={`bg-background shadow-sm overflow-hidden ${
                                    errors.local_infrastructure_requirements
                                        ? "border-red-500 bg-red-50"
                                        : "border-muted-200"
                                }`}
                            >
                                {payload.is_infrastructure && (
                                    <CollapsibleTableSection
                                        section="local_infrastructure_requirements"
                                        title="Requirements for Operating Cost of Infrastructure Project"
                                        subtitle="Specify direct rights-of-way, structural components, and matching allocations"
                                        collapsed={
                                            collapsedSections.local_infrastructure_requirements
                                        }
                                        onToggle={() =>
                                            toggleSection(
                                                "local_infrastructure_requirements",
                                            )
                                        }
                                        actions={
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    addRow(
                                                        "local_infrastructure_requirements",
                                                        {
                                                            description: "",
                                                            year: payload.proposal_year,
                                                            total_amt: 0,
                                                            costs: [],
                                                        },
                                                    )
                                                }
                                                className="flex items-center gap-2 rounded-lg bg-secondary-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
                                            >
                                                + Add Requirement
                                            </button>
                                        }
                                        summary={
                                            <div className="text-sm text-muted-500 italic">
                                                {
                                                    payload
                                                        .local_infrastructure_requirements
                                                        .length
                                                }{" "}
                                                requirements added.
                                            </div>
                                        }
                                    >
                                        {/* Wrap your original infrastructure requirements table implementation here */}
                                        <div className="">
                                            <div className="max-h-[520px] overflow-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-muted-50/50 border-b border-muted-100">
                                                            <th className="py-3 px-4 text-sm font-black text-muted-400 uppercase w-1/3">
                                                                Description
                                                            </th>
                                                            <th className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center">
                                                                PS
                                                            </th>
                                                            <th className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center">
                                                                MOOE
                                                            </th>
                                                            <th className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center">
                                                                CO
                                                            </th>
                                                            <th className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center">
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
                                                                            value={
                                                                                item.description
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateRow(
                                                                                    "local_infrastructure_requirements",
                                                                                    i,
                                                                                    {
                                                                                        description:
                                                                                            e
                                                                                                .target
                                                                                                .value,
                                                                                    },
                                                                                )
                                                                            }
                                                                        />
                                                                    </td>
                                                                    {(
                                                                        [
                                                                            "PS",
                                                                            "MOOE",
                                                                            "CO",
                                                                            "FINEX",
                                                                        ] as const
                                                                    ).map(
                                                                        (
                                                                            itemClass,
                                                                        ) => (
                                                                            <td
                                                                                key={
                                                                                    itemClass
                                                                                }
                                                                                className="py-2 px-2"
                                                                            >
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-full bg-transparent text-center outline-none text-sm"
                                                                                    placeholder="0"
                                                                                    value={
                                                                                        item.costs.find(
                                                                                            (
                                                                                                c,
                                                                                            ) =>
                                                                                                c.expense_class ===
                                                                                                itemClass,
                                                                                        )
                                                                                            ?.amount ??
                                                                                        ""
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        handleMatrixChange(
                                                                                            "local_infrastructure_requirements",
                                                                                            i,
                                                                                            itemClass,
                                                                                            e
                                                                                                .target
                                                                                                .valueAsNumber ||
                                                                                                0,
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </td>
                                                                        ),
                                                                    )}
                                                                    <td className="py-3 px-4">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                removeRow(
                                                                                    "local_infrastructure_requirements",
                                                                                    i,
                                                                                )
                                                                            }
                                                                            className="text-red-400 hover:text-red-600 transition-colors"
                                                                            title="Remove Component"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ),
                                                        )}
                                                    </tbody>
                                                </table>

                                                {payload
                                                    .local_infrastructure_requirements
                                                    .length === 0 && (
                                                    <div className="p-8 text-center text-muted-400 text-sm italic">
                                                        No locations added.
                                                        Click &quot;+ ADD
                                                        REQUIREMENT&quot; to
                                                        begin.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CollapsibleTableSection>
                                )}
                            </div>
                            {getErrorsForPath(
                                "local_infrastructure_requirements",
                            ).length > 0 && (
                                <div className="bg-red-50 border border-red-100 p-3 rounded-lg mb-4">
                                    {getErrorsForPath(
                                        "local_infrastructure_requirements",
                                    ).map((msg, i) => (
                                        <p
                                            key={i}
                                            className="text-sm text-red-600 font-semibold flex items-center gap-1"
                                        >
                                            <span className="w-1 h-1 bg-red-600 rounded-full" />{" "}
                                            {msg}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <div
                            className={`bg-background shadow-sm overflow-hidden ${
                                errors.local_physical_targets
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                        >
                            <CollapsibleTableSection
                                section="local_physical_targets"
                                title="Local Physical Targets"
                                subtitle="Specify targets for the proposal, such as length of roads, number of classrooms, etc."
                                collapsed={
                                    collapsedSections.local_physical_targets
                                }
                                onToggle={() =>
                                    toggleSection("local_physical_targets")
                                }
                                actions={
                                    <button
                                        type="button"
                                        onClick={() =>
                                            addRow("local_physical_targets", {
                                                year: payload.proposal_year,
                                                target_description: "",
                                            })
                                        }
                                        className="rounded-lg bg-secondary-foreground px-4 py-2 text-sm font-semibold text-background transition hover:opacity-90"
                                    >
                                        + Add Target
                                    </button>
                                }
                                summary={
                                    <div className="text-sm text-muted-500 italic">
                                        {payload.local_physical_targets.length}{" "}
                                        targets added.
                                    </div>
                                }
                            >
                                <div className="max-h-[520px] overflow-auto">
                                    {payload.local_physical_targets.map(
                                        (target, i) => (
                                            <div
                                                key={i}
                                                className="flex gap-4 p-4"
                                            >
                                                <input
                                                    className="flex-1 border-b text-sm"
                                                    placeholder="Target Description"
                                                    value={
                                                        target.target_description
                                                    }
                                                    onChange={(e) =>
                                                        updateRow(
                                                            "local_physical_targets",
                                                            i,
                                                            {
                                                                target_description:
                                                                    e.target
                                                                        .value,
                                                            },
                                                        )
                                                    }
                                                />
                                                <input
                                                    type="number"
                                                    className="w-24 border-b text-sm"
                                                    placeholder="Year"
                                                    value={target.year ?? ""}
                                                    min={payload.proposal_year}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            "local_physical_targets",
                                                            i,
                                                            {
                                                                year: parseInt(
                                                                    e.target
                                                                        .value,
                                                                ),
                                                            },
                                                        )
                                                    }
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeRow(
                                                            "local_physical_targets",
                                                            i,
                                                        )
                                                    }
                                                    className="text-red-400 hover:text-red-600 transition-colors"
                                                    title="Remove Component"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ),
                                    )}
                                </div>
                                {payload.local_physical_targets.length ===
                                    0 && (
                                    <div className="p-8 text-center text-muted-400 text-sm italic">
                                        No Local Physical Targets added. Click
                                        &quot;+ ADD TARGET&quot; to begin.
                                    </div>
                                )}
                            </CollapsibleTableSection>
                        </div>
                        {getErrorsForPath("local_physical_targets").length >
                            0 && (
                            <div className="bg-red-50 border border-red-100 p-3 rounded-lg mb-4">
                                {getErrorsForPath("local_physical_targets").map(
                                    (msg, i) => (
                                        <p
                                            key={i}
                                            className="text-sm text-red-600 font-semibold flex items-center gap-1"
                                        >
                                            <span className="w-1 h-1 bg-red-600 rounded-full" />{" "}
                                            {msg}
                                        </p>
                                    ),
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 5. FOREIGN ASSISTANCE (BP 203 ONLY) */}
            {type === "203" && (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <div
                            className={`shadow-sm overflow-hidden  ${
                                errors.foreign_financial_targets
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                        >
                            <CollapsibleTableSection
                                section="foreign_financial_targets"
                                title="Foreign Financial Targets"
                                subtitle="Manage loan proceeds, grants, and GOP counterpart financing schedules"
                                collapsed={
                                    collapsedSections.foreign_financial_targets
                                }
                                onToggle={() =>
                                    toggleSection("foreign_financial_targets")
                                }
                                actions={
                                    <button
                                        type="button"
                                        onClick={() =>
                                            addRow(
                                                "foreign_financial_targets",
                                                {
                                                    year: payload.proposal_year,
                                                    lp_imprest: 0,
                                                    lp_direct: 0,
                                                    grant: 0,
                                                    gop: 0,
                                                },
                                            )
                                        }
                                        className="rounded-lg
                bg-secondary-foreground
                px-4
                py-2
                text-sm
                font-semibold
                text-background
                transition
                hover:opacity-90  "
                                    >
                                        + Add Financial Target
                                    </button>
                                }
                                summary={
                                    <div className="text-sm text-muted-500 italic">
                                        {
                                            payload.foreign_financial_targets
                                                .length
                                        }{" "}
                                        fiscal year rows configured.
                                    </div>
                                }
                            >
                                <div className="">
                                    <div className="max-h-[520px] overflow-auto">
                                        <table className="w-full table-fixed text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted-50/50 border-b border-muted-100 text-sm font-black text-muted-400 uppercase">
                                                    <th
                                                        rowSpan={2}
                                                        className="py-4 px-4 border-r w-24"
                                                    >
                                                        Year
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="py-2 text-center border-b border-r"
                                                    >
                                                        LP (Loan Proceeds)
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-4 px-2 text-center border-r"
                                                    >
                                                        Grant
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-4 px-2 text-center border-r"
                                                    >
                                                        GOP
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-4 px-2 text-center bg-muted-100/50"
                                                    >
                                                        Total
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="w-10"
                                                    ></th>
                                                </tr>
                                                <tr className="bg-muted-50/50 border-b border-muted-100 text-sm font-black text-muted-400 uppercase">
                                                    <th className="py-2 px-2 text-center border-r">
                                                        Imprest/Special
                                                    </th>
                                                    <th className="py-2 px-2 text-center border-r">
                                                        Direct Payment
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-muted-50">
                                                {payload.foreign_financial_targets.map(
                                                    (target, i) => {
                                                        const rowTotal =
                                                            Number(
                                                                target.lp_imprest ||
                                                                    0,
                                                            ) +
                                                            Number(
                                                                target.lp_direct ||
                                                                    0,
                                                            ) +
                                                            Number(
                                                                target.grant ||
                                                                    0,
                                                            ) +
                                                            Number(
                                                                target.gop || 0,
                                                            );

                                                        return (
                                                            <tr
                                                                key={i}
                                                                className="hover:bg-muted-50/30 transition-colors group"
                                                            >
                                                                <td className="py-3 px-4 border-r">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-transparent font-medium text-muted-700 outline-none"
                                                                        min={
                                                                            payload.proposal_year
                                                                        }
                                                                        value={
                                                                            target.year
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateRow(
                                                                                "foreign_financial_targets",
                                                                                i,
                                                                                {
                                                                                    year: parseInt(
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                    ),
                                                                                },
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-2 border-r">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-transparent text-center outline-none text-sm text-muted-600 focus:text-secondary-foreground"
                                                                        placeholder="0"
                                                                        min={0}
                                                                        value={
                                                                            target.lp_imprest ||
                                                                            ""
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateRow(
                                                                                "foreign_financial_targets",
                                                                                i,
                                                                                {
                                                                                    lp_imprest:
                                                                                        Number(
                                                                                            e
                                                                                                .target
                                                                                                .value ||
                                                                                                0,
                                                                                        ),
                                                                                },
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-2 border-r">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-transparent text-center outline-none text-sm text-muted-600 focus:text-secondary-foreground"
                                                                        placeholder="0"
                                                                        min={0}
                                                                        value={
                                                                            target.lp_direct ||
                                                                            ""
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateRow(
                                                                                "foreign_financial_targets",
                                                                                i,
                                                                                {
                                                                                    lp_direct:
                                                                                        Number(
                                                                                            e
                                                                                                .target
                                                                                                .value ||
                                                                                                0,
                                                                                        ),
                                                                                },
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-2 border-r">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-transparent text-center outline-none text-sm text-muted-600 focus:text-secondary-foreground"
                                                                        placeholder="0"
                                                                        min={0}
                                                                        value={
                                                                            target.grant ||
                                                                            ""
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateRow(
                                                                                "foreign_financial_targets",
                                                                                i,
                                                                                {
                                                                                    grant: Number(
                                                                                        e
                                                                                            .target
                                                                                            .value ||
                                                                                            0,
                                                                                    ),
                                                                                },
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-2 border-r">
                                                                    <input
                                                                        type="number"
                                                                        className="w-full bg-transparent text-center outline-none text-sm text-muted-600 focus:text-secondary-foreground"
                                                                        placeholder="0"
                                                                        min={0}
                                                                        value={
                                                                            target.gop ||
                                                                            ""
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateRow(
                                                                                "foreign_financial_targets",
                                                                                i,
                                                                                {
                                                                                    gop: Number(
                                                                                        e
                                                                                            .target
                                                                                            .value ||
                                                                                            0,
                                                                                    ),
                                                                                },
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4 text-center font-bold text-muted-700 bg-muted-50/50">
                                                                    {rowTotal.toLocaleString()}
                                                                </td>
                                                                <td className="py-3 px-2 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            removeRow(
                                                                                "foreign_financial_targets",
                                                                                i,
                                                                            )
                                                                        }
                                                                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    },
                                                )}
                                            </tbody>
                                        </table>
                                        {payload.foreign_financial_targets
                                            .length === 0 && (
                                            <div className="p-8 text-center text-muted-400 text-sm italic">
                                                No foreign financial targets
                                                added. Click &quot;+ ADD
                                                FINANCIAL TARGET&quot; to begin.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CollapsibleTableSection>
                        </div>
                        {getErrorsForPath("foreign_financial_targets").length >
                            0 && (
                            <div className="bg-red-50 border border-red-100 p-3 rounded-lg mb-4">
                                {getErrorsForPath(
                                    "foreign_financial_targets",
                                ).map((msg, i) => (
                                    <p
                                        key={i}
                                        className="text-sm text-red-600 font-semibold flex items-center gap-1"
                                    >
                                        <span className="w-1 h-1 bg-red-600 rounded-full" />{" "}
                                        {msg}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div
                            className={`shadow-sm overflow-hidden  ${
                                errors.foreign_physical_targets
                                    ? "border-red-500 bg-red-50"
                                    : "border-muted-200"
                            }`}
                        >
                            <CollapsibleTableSection
                                section="foreign_physical_targets"
                                title="Foreign Physical Targets"
                                subtitle="Identify physical delivery requirements tied to foreign-assisted components"
                                collapsed={
                                    collapsedSections.foreign_physical_targets
                                }
                                onToggle={() =>
                                    toggleSection("foreign_physical_targets")
                                }
                                actions={
                                    <button
                                        type="button"
                                        onClick={() =>
                                            addRow("foreign_physical_targets", {
                                                name: "",
                                                costs: [],
                                            })
                                        }
                                        className="rounded-lg
                bg-secondary-foreground
                px-4
                py-2
                text-sm
                font-semibold
                text-background
                transition
                hover:opacity-90  "
                                    >
                                        + Add Physical Target
                                    </button>
                                }
                                summary={
                                    <div className="text-sm text-muted-500 italic">
                                        {
                                            payload.foreign_physical_targets
                                                .length
                                        }{" "}
                                        target profiles defined.
                                    </div>
                                }
                            >
                                <div className="">
                                    <div className="overflow-x-auto">
                                        <div className="max-h-[520px] overflow-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-muted-50/50 border-b text-sm font-black text-muted-400 uppercase">
                                                        <th className="py-4 px-4 border-r w-64">
                                                            Components
                                                        </th>
                                                        {(
                                                            [
                                                                "PS",
                                                                "MOOE",
                                                                "CO",
                                                                "FINEX",
                                                            ] as const
                                                        ).map((ec) => (
                                                            <th
                                                                key={ec}
                                                                className="px-2 text-center border-r last:border-r-0 min-w-[180px]"
                                                            >
                                                                {ec}
                                                            </th>
                                                        ))}
                                                        <th className="w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-muted-50">
                                                    {payload.foreign_physical_targets.map(
                                                        (phys, i) => (
                                                            <tr
                                                                key={i}
                                                                className="hover:bg-muted-50/30 transition-colors group"
                                                            >
                                                                <td className="py-3 px-4 border-r align-top">
                                                                    <input
                                                                        className="w-full bg-transparent font-medium text-muted-700 outline-none"
                                                                        placeholder="Enter Component Name..."
                                                                        value={
                                                                            phys.name
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateRow(
                                                                                "foreign_physical_targets",
                                                                                i,
                                                                                {
                                                                                    name: e
                                                                                        .target
                                                                                        .value,
                                                                                },
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                                {(
                                                                    [
                                                                        "PS",
                                                                        "MOOE",
                                                                        "CO",
                                                                        "FINEX",
                                                                    ] as const
                                                                ).map((ec) => {
                                                                    // HELPER: Find specific cost objects by class, category, and method
                                                                    const getCost =
                                                                        (
                                                                            cat:
                                                                                | "LP"
                                                                                | "GOP",
                                                                            method?:
                                                                                | "cash"
                                                                                | "non_cash",
                                                                        ) =>
                                                                            phys.costs.find(
                                                                                (
                                                                                    c,
                                                                                ) =>
                                                                                    c.expense_class ===
                                                                                        ec &&
                                                                                    c.fund_category ===
                                                                                        cat &&
                                                                                    (cat !==
                                                                                        "LP" ||
                                                                                        c.fund_method ===
                                                                                            method ||
                                                                                        (method ===
                                                                                            "non_cash" &&
                                                                                            c.fund_method ===
                                                                                                "non-cash")),
                                                                            )
                                                                                ?.amount ||
                                                                            "";

                                                                    const lpCash =
                                                                        Number(
                                                                            getCost(
                                                                                "LP",
                                                                                "cash",
                                                                            ) ||
                                                                                0,
                                                                        );
                                                                    const lpNonCash =
                                                                        Number(
                                                                            getCost(
                                                                                "LP",
                                                                                "non_cash",
                                                                            ) ||
                                                                                0,
                                                                        );
                                                                    const gop =
                                                                        Number(
                                                                            getCost(
                                                                                "GOP",
                                                                            ) ||
                                                                                0,
                                                                        );
                                                                    const cellTotal =
                                                                        lpCash +
                                                                        lpNonCash +
                                                                        gop;

                                                                    return (
                                                                        <td
                                                                            key={
                                                                                ec
                                                                            }
                                                                            className="p-3 border-r last:border-r-0 align-top min-w-[160px]"
                                                                        >
                                                                            <div className="flex flex-col gap-2">
                                                                                {/* LP Cash Input */}
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <span className="text-sm font-bold text-muted-500 w-12">
                                                                                        LP
                                                                                        CASH
                                                                                    </span>
                                                                                    <input
                                                                                        type="number"
                                                                                        className="flex-1 text-center border border-muted-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-secondary-foreground"
                                                                                        min={
                                                                                            0
                                                                                        }
                                                                                        value={getCost(
                                                                                            "LP",
                                                                                            "cash",
                                                                                        )}
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleMatrixChange203(
                                                                                                i,
                                                                                                ec,
                                                                                                "LP",
                                                                                                e
                                                                                                    .target
                                                                                                    .valueAsNumber ||
                                                                                                    0,
                                                                                                "foreign_physical_targets",
                                                                                                "cash",
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>

                                                                                {/* LP Non-Cash Input */}
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <span className="text-sm font-bold text-muted-500 w-12">
                                                                                        LP
                                                                                        NON-CASH
                                                                                    </span>
                                                                                    <input
                                                                                        type="number"
                                                                                        className="flex-1 text-center border border-muted-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-secondary-foreground"
                                                                                        min={
                                                                                            0
                                                                                        }
                                                                                        value={getCost(
                                                                                            "LP",
                                                                                            "non_cash",
                                                                                        )}
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleMatrixChange203(
                                                                                                i,
                                                                                                ec,
                                                                                                "LP",
                                                                                                e
                                                                                                    .target
                                                                                                    .valueAsNumber ||
                                                                                                    0,
                                                                                                "foreign_physical_targets",
                                                                                                "non_cash",
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>

                                                                                {/* GOP Input */}
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <span className="text-sm font-bold text-muted-500 w-12">
                                                                                        GOP
                                                                                    </span>
                                                                                    <input
                                                                                        type="number"
                                                                                        className="flex-1 text-center bg-white border border-muted-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                                                        min={
                                                                                            0
                                                                                        }
                                                                                        value={getCost(
                                                                                            "GOP",
                                                                                        )}
                                                                                        onChange={(
                                                                                            e,
                                                                                        ) =>
                                                                                            handleMatrixChange203(
                                                                                                i,
                                                                                                ec,
                                                                                                "GOP",
                                                                                                e
                                                                                                    .target
                                                                                                    .valueAsNumber ||
                                                                                                    0,
                                                                                                "foreign_physical_targets",
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                </div>

                                                                                {/* Sub-total for this Expense Class */}
                                                                                <div className="mt-1 pt-1 border-t border-dashed border-muted-200 flex justify-between items-center">
                                                                                    <span className="text-sm uppercase tracking-wider font-semibold text-muted-400">
                                                                                        Total
                                                                                    </span>
                                                                                    <span className="text-sm font-mono font-bold text-secondary-foreground">
                                                                                        {cellTotal.toLocaleString(
                                                                                            undefined,
                                                                                            {
                                                                                                minimumFractionDigits: 2,
                                                                                            },
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="py-3 px-4 text-center font-bold text-muted-700 bg-muted-50/50">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            removeRow(
                                                                                "foreign_physical_targets",
                                                                                i,
                                                                            )
                                                                        }
                                                                        className="text-red-400 hover:text-red-600 transition-opacity"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </CollapsibleTableSection>
                        </div>
                        {getErrorsForPath("foreign_physical_targets").length >
                            0 && (
                            <div className="bg-red-50 border border-red-100 p-3 rounded-lg mb-4">
                                {getErrorsForPath(
                                    "foreign_physical_targets",
                                ).map((msg, i) => (
                                    <p
                                        key={i}
                                        className="text-sm text-red-600 font-semibold flex items-center gap-1"
                                    >
                                        <span className="w-1 h-1 bg-red-600 rounded-full" />{" "}
                                        {msg}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isDbmOverwrite && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <label
                        htmlFor="override-remarks"
                        className="text-sm font-bold text-secondary-foreground"
                    >
                        DBM Override Remarks
                    </label>
                    <textarea
                        id="override-remarks"
                        value={overrideRemarks}
                        onChange={(event) =>
                            setOverrideRemarks(event.target.value)
                        }
                        className="min-h-24 w-full rounded border border-border bg-background px-3 py-2 text-sm"
                        placeholder="State why this DBM overwrite or change is being made."
                        required
                    />
                    <p className="text-sm text-muted-foreground">
                        Required for DBM overrides and recorded in the
                        administrative override history.
                    </p>
                </div>
            )}

            <div className="sticky bottom-0 z-40 mx-auto border-t bg-background/95 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
                <div className="mx-auto flex max-w-5xl justify-end gap-3">
                    {!isDbmOverwrite && (
                        <button
                            type="submit"
                            disabled={isLoading}
                            onClick={() => setSubmitAction("draft")}
                            className="px-6 py-2 text-muted-600 font-bold hover:bg-muted-50 rounded-lg border hover:bg-secondary-foreground hover:text-white hover:shadow-md"
                        >
                            Save Draft
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isLoading}
                        onClick={() =>
                            setSubmitAction(
                                isDbmOverwrite
                                    ? "pending_dbm"
                                    : "pending_budget",
                            )
                        }
                        className="px-6 py-2 bg-secondary-foreground-600 border border-primary-foreground text-primary-foreground font-bold rounded-lg shadow-md hover:bg-primary-foreground hover:text-white hover:shadow-lg"
                    >
                        {isDbmOverwrite ? "Overwrite Form" : "Submit Proposal"}
                    </button>
                </div>
            </div>
        </form>
        </>
    );
}
