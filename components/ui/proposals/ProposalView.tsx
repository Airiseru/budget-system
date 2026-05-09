"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { SignSection } from "@/components/ui/digital-signatures/SignSection";
import BudgetPrepClosedBanner from "@/components/ui/BudgetPrepClosedBanner";
import { PROPOSAL_WORKFLOW } from "@/src/lib/workflows/proposal-flow";
import Link from "next/link";
import {
    Pencil,
    MapPin,
    Target,
    Landmark,
    FileText,
    Gavel,
    Building,
    Component,
    Banknote,
} from "lucide-react";
import { FullProjectProposal } from "@/src/types/project_proposals";
import BackButton from "../BackButton";
import FormDeleteButton from "../FormDeleteButton";
import { STATUS_BADGE_COLORS, STATUS_LABELS } from "@/src/lib/constants";

type ProposalExpenseClass = "PS" | "MOOE" | "CO" | "FE" | "FINEX";

type ProposalExpenseValue = {
    expense_class: ProposalExpenseClass;
    amount: number;
};

type ProposalCostEntry = {
    year?: number;
    tier?: number;
    expense_class?: ProposalExpenseClass;
    amount?: number;
    expense_classes?: ProposalExpenseValue[];
};

type ProposalCostedItem = {
    component_name?: string;
    description?: string;
    location?: string;
    costs?: ProposalCostEntry[];
};

type ProposalPrerequisite = {
    name: string;
    type: string;
    status: string;
    remarks: string | null;
};

type ProposalLocalPhysicalTarget = {
    target_description: string;
    year: number;
};

type ProposalViewData = FullProjectProposal & {
    pap_prerequisites?: ProposalPrerequisite[];
    cost_by_components?: ProposalCostedItem[];
    local_financial_attributions?: ProposalCostedItem[];
    local_locations?: ProposalCostedItem[];
    local_physical_targets?: ProposalLocalPhysicalTarget[];
    local_infrastructure_requirements?: ProposalCostedItem[];
};

interface ProposalViewProps {
    data: any;
    session: any;
    backUrl: string;
    isDbmEvaluator?: boolean;
    originalFormId: string;
    versionTabs: {
        id: string;
        version: number;
        parent_form_id: string | null;
        auth_status: string | null;
        updated_at: Date;
    }[];
    userInWorkflow: boolean;
    userCanSign: boolean;
    budgetPrepClosedForEntityActions?: boolean;
    currentSignatoryRole: string | null;
    existingSignature: any;
    allSignatures: any[];
    pastSignatures: {
        id: string;
        user_name: string;
        role: string;
        created_at: Date;
    }[];
    latestRejection: {
        remarks: string | null;
        changed_at: Date;
        user_name: string | null;
    } | null;
    updateAuthStatus: () => Promise<void>;
    deleteFormAction: (id: string) => Promise<void>;
}

const EXPENSE_CLASSES = ["PS", "MOOE", "CO", "FINEX"];

const CostBreakdownColumns = ({ item }: { item: ProposalCostedItem }) => {
    if (!item.costs || item.costs.length === 0) {
        return (
            <td className="p-4 text-center col-span-4 text-muted-400 italic text-sm">
                No financial data recorded
            </td>
        );
    }

    return (
        <>
            {EXPENSE_CLASSES.map((cls) => {
                const costEntry = item.costs?.find(
                    (c) => c.expense_class === cls,
                );
                return (
                    <td
                        key={cls}
                        className="p-4 text-right border-l font-mono text-sm"
                    >
                        {costEntry
                            ? Number(costEntry.amount).toLocaleString(
                                  undefined,
                                  {
                                      minimumFractionDigits: 2,
                                  },
                              )
                            : "-"}
                    </td>
                );
            })}
        </>
    );
};

const getStatusStyles = (status: string) => {
    switch (status) {
        case "True":
            return "text-green-700 hover:bg-green-100 border-green-700";
        case "False":
            return "text-destructive hover:bg-destructive/10 border-destructive";
        case "Not Applicable":
            return "text-muted-500 hover:text-foreground hover:bg-muted-foreground/10 border-muted-200";
        default:
            return "text-muted-500 hover:bg-black";
    }
};

const FUND_SOURCES = [
    { label: "LP - Cash", category: "LP", method: "cash" },
    { label: "LP - Non-Cash", category: "LP", method: "non_cash" },
    { label: "GOP", category: "GOP", method: null },
];

export default function ProposalView({
    data,
    session,
    backUrl,
    isDbmEvaluator = false,
    originalFormId,
    versionTabs,
    userInWorkflow,
    userCanSign,
    budgetPrepClosedForEntityActions = false,
    currentSignatoryRole,
    existingSignature,
    allSignatures,
    pastSignatures,
    latestRejection,
    updateAuthStatus,
    deleteFormAction,
}: ProposalViewProps) {
    const formData = {
        id: data.id,
        fiscal_year: data.fiscal_year,
        form_id: data.id,
    };

    const budgetYear = Number(data.proposal_year);
    const forwardYear1 = budgetYear + 1;
    const forwardYear2 = budgetYear + 2;

    // --- NEW VERSIONING LOGIC ---
    const familyHasApprovedVersion = versionTabs.some(
        (version) => version.auth_status === "approved",
    );
    const canEditCurrentVersion =
        !familyHasApprovedVersion &&
        ((data.auth_status === "draft" &&
            session.user.access_level === "encode") ||
            (data.auth_status === "pending_dbm" && isDbmEvaluator));

    const canSignCurrentVersion = !familyHasApprovedVersion && userCanSign;

    const signSectionStatusMessage =
        familyHasApprovedVersion && data.auth_status !== "approved"
            ? "DBM has already approved a different version of this form. This version is locked."
            : undefined;

    return (
        <div className="m-6 max-w-5xl mx-auto space-y-10 pb-20">
            {budgetPrepClosedForEntityActions &&
                data.auth_status === "draft" && (
                    <BudgetPrepClosedBanner message="The budget preparation phase for this fiscal year is over. You can no longer edit, submit, or sign this form until DBM reopens the cycle for this fiscal year." />
                )}
            {/* NAVIGATION & ACTIONS */}
            <div className="flex justify-between items-center mb-6">
                <BackButton url={backUrl} label="Back" />
                {canEditCurrentVersion && !budgetPrepClosedForEntityActions && (
                    <div className="flex flex-row gap-2">
                        <Link
                            href={`/forms/proposals/${data.id}/edit`}
                            className="flex items-center gap-2 bg-accent-foreground hover:bg-accent-foreground/80 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all shadow-sm"
                        >
                            <Pencil size={14} />
                            {session.user.role !== "dbm"
                                ? "Edit Form"
                                : "Overwrite Form"}
                        </Link>
                        <form action={updateAuthStatus}>
                            <button
                                type="submit"
                                className="bg-secondary-foreground text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-secondary-foreground/80"
                            >
                                {session.user.role !== "dbm"
                                    ? "Submit Form"
                                    : "Finalize Overwrite"}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* HEADER SECTION */}
            <div className="text-center space-y-2 mb-8">
                <Badge
                    variant="outline"
                    className="uppercase tracking-widest text-sm"
                >
                    BP Form {data.type}
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight uppercase">
                    {data.title || "Untitled Project Proposal"}
                </h1>
                <div className="flex justify-center gap-2 items-center">
                    <Badge
                        variant={
                            STATUS_BADGE_COLORS[data.auth_status ?? "draft"] ??
                            "default"
                        }
                        className="py-1.5 px-4 rounded-full"
                    >
                        {STATUS_LABELS[data.auth_status ?? ""] ??
                            data.auth_status}
                    </Badge>
                </div>
                <p className="text-muted-500 text-sm">
                    Fiscal Year {data.proposal_year} •{" "}
                    {data.is_new ? "New" : "Expanded"} Project
                </p>
            </div>

            {/* --- NEW VERSION TABS --- */}
            {versionTabs.length > 1 && (
                <section className="space-y-3 mb-10">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {versionTabs.map((tab) => {
                            const isActive = tab.id === data.id;
                            const isOriginal = tab.id === originalFormId;
                            return (
                                <Link
                                    key={tab.id}
                                    href={`/forms/proposals/${tab.id}`}
                                    className={`min-w-[168px] rounded-xl border px-4 py-3 text-left transition-colors ${
                                        isActive
                                            ? "border-accent-foreground bg-accent-foreground/10 text-accent-foreground"
                                            : "border-border bg-card hover:border-accent-foreground/40 hover:bg-accent/40"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-bold">
                                            {isOriginal
                                                ? `Original (v${tab.version})`
                                                : `DBM (v${tab.version})`}
                                        </span>
                                        <span className="text-sm font-medium">
                                            {
                                                STATUS_LABELS[
                                                    tab.auth_status ?? "draft"
                                                ]
                                            }
                                        </span>
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Updated{" "}
                                        {new Date(
                                            tab.updated_at,
                                        ).toLocaleDateString()}
                                    </p>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* CORE STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 border rounded-lg shadow-sm flex flex-col justify-between">
                    <label className="text-sm uppercase font-bold text-muted-foreground">
                        Total Proposal Cost
                    </label>
                    <p className="text-lg font-semibold font-mono">
                        {data.total_proposal_currency}{" "}
                        {Number(data.total_proposal_cost).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white p-4 border rounded-lg shadow-sm flex flex-col justify-between">
                    <label className="text-sm uppercase font-bold text-muted-foreground">
                        Priority Rank
                    </label>
                    <p className="text-lg font-semibold">
                        #{data.priority_rank}
                    </p>
                </div>
                <div className="p-4 bg-muted-50 rounded-xl border border-muted-100 flex flex-col justify-between">
                    <label className="text-sm font-bold text-muted-foreground uppercase">
                        Sector Classification
                    </label>
                    <p className="text-lg font-bold text-muted-800">
                        {data.is_infrastructure
                            ? "Infrastructure"
                            : "Non-Infrastructure"}
                        {data.for_ict && " • ICT"}
                    </p>
                </div>
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="flex flex-col gap-10">
                {/* Prerequisites */}
                <div className="space-y-4">
                    <h3 className="text-md font-black uppercase text-muted-400 tracking-widest flex items-center gap-2">
                        <Landmark size={14} /> Prerequisites
                    </h3>
                    <section className="space-y-3">
                        <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <Gavel size={14} /> Approving Authorities
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            {data.pap_prerequisites?.map(
                                (pre: any, i: number) =>
                                    pre.type === "authority" && (
                                        <div
                                            key={i}
                                            className={`p-3 bg-white border rounded-lg shadow-sm ${getStatusStyles(pre.status)}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold text-muted-700">
                                                    {pre.name}
                                                </p>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[8px] px-1.5 py-0.5 capitalize shadow-none ${getStatusStyles(pre.status)}`}
                                                >
                                                    {pre.status == "True"
                                                        ? "Approved"
                                                        : pre.status == "False"
                                                          ? "Not Approved"
                                                          : "Not Applicable"}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-500 mt-1 italic whitespace-normal break-words">
                                                Remarks: {pre.remarks}
                                            </p>
                                        </div>
                                    ),
                            )}
                        </div>
                    </section>
                    <section className="space-y-3">
                        <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <FileText size={14} /> Supporting Documents
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            {data.pap_prerequisites?.map(
                                (pre: any, i: number) =>
                                    pre.type === "document" && (
                                        <div
                                            key={i}
                                            className={`p-3 bg-white border rounded-lg shadow-sm ${getStatusStyles(pre.status)}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold text-muted-700">
                                                    {pre.name}
                                                </p>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[8px] px-1.5 py-0.5 capitalize shadow-none ${getStatusStyles(pre.status)}`}
                                                >
                                                    {pre.status == "True"
                                                        ? "Approved"
                                                        : pre.status == "False"
                                                          ? "Not Approved"
                                                          : "Not Applicable"}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-500 mt-1 italic">
                                                Remarks: {pre.remarks}
                                            </p>
                                        </div>
                                    ),
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {/* FORM 202 SPECIFIC: LOCAL DETAILS */}
            {data.type === "202" && (
                <div className="space-y-8">
                    {/* Core Components */}
                    <div className="space-y-4">
                        <h3 className="text-md font-black uppercase text-secondary-foreground tracking-widest flex items-center gap-2">
                            <Component size={12} />
                            Cost by Components
                        </h3>
                        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th className="py-3 px-4 text-sm font-black text-muted-400 uppercase w-1/3">
                                            Component Name
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
                                <tbody className="divide-y">
                                    {data.cost_by_components?.map(
                                        (comp: any, i: number) => (
                                            <tr key={i}>
                                                <td className="p-4 font-medium text-muted-700">
                                                    {comp.component_name}
                                                </td>

                                                <CostBreakdownColumns
                                                    item={comp}
                                                />
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* PAP Attribution Section */}
                    <div className="space-y-4 mt-8">
                        <h3 className="text-md font-black uppercase text-secondary-foreground tracking-widest flex items-center gap-2">
                            <Banknote size={12} />
                            PAP Attribution by Expense Class
                        </h3>
                        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th
                                            rowSpan={2}
                                            className="py-3 px-4 text-sm font-black text-muted-400 uppercase text-left border-r border-muted-100"
                                        >
                                            PAP Description / Expense Class
                                        </th>
                                        <th
                                            colSpan={3}
                                            className="py-2 px-2 text-sm font-black text-muted-400 uppercase text-center border-muted-100 border-r border-muted-100"
                                        >
                                            FY {budgetYear}
                                        </th>
                                        <th
                                            rowSpan={2}
                                            className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center border-r border-muted-100"
                                        >
                                            FY {forwardYear1} T1
                                        </th>
                                        <th
                                            rowSpan={2}
                                            className="py-3 px-2 text-sm font-black text-muted-400 uppercase text-center"
                                        >
                                            FY {forwardYear2} T1
                                        </th>
                                    </tr>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th className="py-2 px-2 text-[9px] font-bold text-muted-400 uppercase text-center border-r border-muted-50">
                                            Tier 1
                                        </th>
                                        <th className="py-2 px-2 text-[9px] font-bold text-muted-400 uppercase text-center border-r border-muted-50">
                                            Tier 2
                                        </th>
                                        <th className="py-2 px-2 text-[9px] font-black text-muted-500 uppercase text-center border-r border-muted-100 bg-muted-100/30">
                                            Total
                                        </th>
                                    </tr>
                                </thead>

                                {data.local_financial_attributions?.map(
                                    (attr: any, pIdx: number) => {
                                        const order = [
                                            "PS",
                                            "MOOE",
                                            "CO",
                                            "FINEX",
                                        ];

                                        const uniqueClasses = Array.from(
                                            new Set(
                                                attr.attribution_costs?.flatMap(
                                                    (c: any) =>
                                                        // Add a check for c?.costs to handle the null in your FY 2028 data
                                                        c?.costs
                                                            ?.map(
                                                                (cost: any) =>
                                                                    cost?.expense_class,
                                                            )
                                                            .filter(Boolean) ||
                                                        [],
                                                ),
                                            ),
                                        ).sort(
                                            (a: any, b: any) =>
                                                order.indexOf(a) -
                                                order.indexOf(b),
                                        ) as string[];

                                        const getVal = (
                                            year: number,
                                            tier: number | null,
                                            cls: string | null = null,
                                        ) => {
                                            const yData =
                                                attr.attribution_costs?.find(
                                                    (c: any) =>
                                                        c && // Ensure c is not null (fixes the FY 2028 issue)
                                                        Number(c.year) ===
                                                            year &&
                                                        (tier === null ||
                                                            Number(c.tier) ===
                                                                tier),
                                                );

                                            if (!yData || !yData.costs)
                                                return 0;

                                            if (cls) {
                                                return Number(
                                                    yData.costs.find(
                                                        (cost: any) =>
                                                            cost?.expense_class ===
                                                            cls,
                                                    )?.amount || 0,
                                                );
                                            }

                                            // Sum all costs for that year/tier
                                            return yData.costs.reduce(
                                                (sum: number, cost: any) =>
                                                    sum +
                                                    Number(cost?.amount || 0),
                                                0,
                                            );
                                        };

                                        return (
                                            <tbody
                                                key={pIdx}
                                                className="border-b-2 border-chart-5/50"
                                            >
                                                <tr className="bg-muted-50/20 font-bold divide-x border-b border-chart-5/20">
                                                    <td className="p-4 text-muted-900">
                                                        {attr.description}
                                                    </td>
                                                    <td className="p-4 text-right font-mono">
                                                        {getVal(
                                                            budgetYear,
                                                            1,
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-mono">
                                                        {getVal(
                                                            budgetYear,
                                                            2,
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-mono bg-muted-100/20">
                                                        {(
                                                            getVal(
                                                                budgetYear,
                                                                1,
                                                            ) +
                                                            getVal(
                                                                budgetYear,
                                                                2,
                                                            )
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-mono">
                                                        {getVal(
                                                            forwardYear1,
                                                            1,
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-mono">
                                                        {getVal(
                                                            forwardYear2,
                                                            1,
                                                        ).toLocaleString()}
                                                    </td>
                                                </tr>
                                                {/* Child Rows: Individual Expense Classes */}
                                                {uniqueClasses.map((cls) => {
                                                    const v27t1 = getVal(
                                                        budgetYear,
                                                        1,
                                                        cls,
                                                    );
                                                    const v27t2 = getVal(
                                                        budgetYear,
                                                        2,
                                                        cls,
                                                    );
                                                    const v28t1 = getVal(
                                                        forwardYear1,
                                                        1,
                                                        cls,
                                                    );
                                                    const v29t1 = getVal(
                                                        forwardYear2,
                                                        1,
                                                        cls,
                                                    );

                                                    return (
                                                        <tr
                                                            key={cls}
                                                            className="hover:bg-muted-50/30 transition-colors"
                                                        >
                                                            <td className="p-3 pl-8 text-sm font-medium text-muted-500 border-r border-muted-100 italic">
                                                                {cls}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-sm text-muted-500 border-r border-muted-50">
                                                                {v27t1 > 0
                                                                    ? v27t1.toLocaleString()
                                                                    : "—"}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-sm text-muted-500 border-r border-muted-100">
                                                                {v27t2 > 0
                                                                    ? v27t2.toLocaleString()
                                                                    : "—"}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-sm text-muted-600 bg-muted-50/10 border-r border-muted-100">
                                                                {(
                                                                    v27t1 +
                                                                    v27t2
                                                                ).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-sm text-muted-500 border-r border-muted-100">
                                                                {v28t1 > 0
                                                                    ? v28t1.toLocaleString()
                                                                    : "—"}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-sm text-muted-500">
                                                                {v29t1 > 0
                                                                    ? v29t1.toLocaleString()
                                                                    : "—"}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        );
                                    },
                                )}
                            </table>
                        </div>
                    </div>

                    {/* Locations */}
                    <div className="space-y-3">
                        <h3 className="text-md font-black text-secondary-foreground uppercase flex items-center tracking-widest gap-2">
                            <MapPin size={12} /> Target Locations
                        </h3>
                        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                            <table className="border rounded-xl w-full bg-white overflow-hidden divide-y">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th className="py-3 px-4 text-sm font-black text-muted-400 uppercase w-1/3">
                                            Locations
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
                                <tbody className="divide-y">
                                    {data.local_locations?.map(
                                        (loc: any, i: number) => (
                                            <tr key={i}>
                                                <td className="p-4 text-muted-700">
                                                    {loc.location}
                                                </td>
                                                <CostBreakdownColumns
                                                    item={loc}
                                                />
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Physical Targets */}
                    <div className="space-y-3">
                        <h4 className="text-md font-black text-secondary-foreground uppercase flex items-center tracking-widest gap-2">
                            <Target size={12} /> Physical Targets
                        </h4>
                        <div className="border rounded-xl bg-white overflow-hidden divide-y">
                            {data.local_physical_targets?.map(
                                (pt: any, i: number) => (
                                    <div
                                        key={i}
                                        className="p-4 flex justify-between"
                                    >
                                        <span className="text-sm text-muted-600">
                                            {pt.target_description}
                                        </span>
                                        <span className="text-sm font-mono font-bold text-muted-400">
                                            FY {pt.year}
                                        </span>
                                    </div>
                                ),
                            )}
                        </div>
                    </div>

                    {/* Infrastructure Requirements */}
                    <div className="space-y-3">
                        <h4 className="text-md font-black text-secondary-foreground uppercase flex items-center tracking-widest gap-2">
                            <Building size={12} />
                            Infrastructure Requirements
                        </h4>
                        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th className="py-3 px-4 text-sm font-black text-muted-400 uppercase w-1/3">
                                            Infrastructure Requirement
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
                                <tbody className="divide-y">
                                    {data.local_infrastructure_requirements?.map(
                                        (infra: any, i: number) => (
                                            <tr key={i}>
                                                <td className="p-4 text-muted-700">
                                                    {infra.description}
                                                </td>
                                                <CostBreakdownColumns
                                                    item={infra}
                                                />
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* FORM 203 SPECIFIC: FOREIGN DETAILS */}
            {data.type === "203" && (
                <div className="space-y-8">
                    <div className="bg-background rounded-xl border shadow-sm overflow-hidden mb-6">
                        <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                            <h3 className="text-sm font-black text-muted-500 uppercase tracking-widest">
                                Cost by Components
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b text-sm divide-x font-black text-muted-400 uppercase">
                                        <th className="py-4 px-4 w-64">
                                            Components
                                        </th>
                                        {["PS", "MOOE", "CO", "FINEX"].map(
                                            (ec) => (
                                                <th
                                                    key={ec}
                                                    className="px-2 text-center  min-w-[180px]"
                                                >
                                                    {ec}
                                                </th>
                                            ),
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted-50">
                                    {data.cost_by_components.map(
                                        (comp: any, i: any) => (
                                            <tr
                                                key={i}
                                                className="hover:bg-muted-50/30 divide-x transition-colors group"
                                            >
                                                <td className="py-3 px-4 align-top">
                                                    {comp.component_name}
                                                </td>
                                                {[
                                                    "PS",
                                                    "MOOE",
                                                    "CO",
                                                    "FINEX",
                                                ].map((ec) => {
                                                    const getCost = (
                                                        cat: "LP" | "GOP",
                                                        method?:
                                                            | "cash"
                                                            | "non_cash",
                                                    ) =>
                                                        comp.costs?.find(
                                                            (c: any) =>
                                                                c.expense_class ===
                                                                    ec &&
                                                                c.fund_category ===
                                                                    cat &&
                                                                (cat !== "LP" ||
                                                                    c.fund_method ===
                                                                        method),
                                                        )?.amount || "";

                                                    const lpCash = Number(
                                                        getCost("LP", "cash") ||
                                                            0,
                                                    );
                                                    const lpNonCash = Number(
                                                        getCost(
                                                            "LP",
                                                            "non_cash",
                                                        ) || 0,
                                                    );
                                                    const gop = Number(
                                                        getCost("GOP") || 0,
                                                    );
                                                    const cellTotal =
                                                        lpCash +
                                                        lpNonCash +
                                                        gop;
                                                    return (
                                                        <td
                                                            key={ec}
                                                            className="p-3  align-top min-w-[160px]"
                                                        >
                                                            <div className="flex flex-col gap-2">
                                                                {/* LP Cash Input */}
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-bold text-muted-500 w-12">
                                                                        LP CASH
                                                                    </span>
                                                                    <div
                                                                        key={`${ec}-LP-CASH`}
                                                                        className="flex-1 text-right bg-white border border-muted-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 "
                                                                    >
                                                                        {getCost(
                                                                            "LP",
                                                                            "cash",
                                                                        )
                                                                            ? getCost(
                                                                                  "LP",
                                                                                  "cash",
                                                                              ).toLocaleString()
                                                                            : "-"}
                                                                    </div>
                                                                </div>

                                                                {/* LP Non-Cash Input */}
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-bold text-muted-500 w-12">
                                                                        LP
                                                                        NON-CASH
                                                                    </span>
                                                                    <div
                                                                        key={`${ec}-LP-NON-CASH`}
                                                                        className="flex-1 text-right bg-white border border-muted-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 "
                                                                    >
                                                                        {getCost(
                                                                            "LP",
                                                                            "non_cash",
                                                                        )
                                                                            ? getCost(
                                                                                  "LP",
                                                                                  "non_cash",
                                                                              ).toLocaleString()
                                                                            : "-"}
                                                                    </div>
                                                                </div>

                                                                {/* GOP Input */}
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-bold text-muted-500 w-12">
                                                                        GOP
                                                                    </span>
                                                                    <div
                                                                        key={`${ec}-GOP`}
                                                                        className="flex-1 text-right bg-white border border-muted-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 "
                                                                    >
                                                                        {getCost(
                                                                            "GOP",
                                                                            "cash",
                                                                        )
                                                                            ? getCost(
                                                                                  "GOP",
                                                                                  "cash",
                                                                              ).toLocaleString()
                                                                            : "-"}
                                                                    </div>
                                                                </div>

                                                                {/* Sub-total for this Expense Class */}
                                                                <div className="mt-1 pt-1 border-t border-dashed border-muted-200 flex justify-between items-center">
                                                                    <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-400">
                                                                        Total
                                                                    </span>
                                                                    <span className="text-sm font-mono font-bold text-blue-600">
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
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-background rounded-xl border shadow-sm overflow-hidden mb-6">
                        {/* Header with Add Button */}
                        <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                            <h3 className="text-sm font-black text-muted-500 uppercase tracking-widest">
                                Foreign Financial Targets (Loan/Grant)
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
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
                                        <th rowSpan={2} className="w-10"></th>
                                    </tr>
                                    <tr className="bg-muted-50/50 border-b border-muted-100 text-[9px] font-black text-muted-400 uppercase">
                                        <th className="py-2 px-2 text-center border-r">
                                            Imprest/Special
                                        </th>
                                        <th className="py-2 px-2 text-center border-r">
                                            Direct Payment
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted-50">
                                    {data.foreign_financial_targets.map(
                                        (target: any, i: any) => {
                                            const rowTotal =
                                                Number(target.lp_imprest || 0) +
                                                Number(target.lp_direct || 0) +
                                                Number(target.grant || 0) +
                                                Number(target.gop || 0);

                                            return (
                                                <tr
                                                    key={i}
                                                    className="hover:bg-muted-50/30 transition-colors group"
                                                >
                                                    <td className="py-3 px-4 border-r">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {target.year || ""}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-2 border-r">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {target.lp_imprest ||
                                                                ""}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-2 border-r">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {target.lp_direct ||
                                                                ""}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-2 border-r">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {target.grant || ""}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-2 border-r">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {target.gop || ""}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-bold text-muted-700 bg-muted-50/50">
                                                        {rowTotal.toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        },
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-background rounded-xl border shadow-sm overflow-hidden mb-6">
                        <div className="bg-muted-50 px-4 py-3 border-b flex justify-between items-center">
                            <h3 className="text-sm font-black text-muted-500 uppercase tracking-widest">
                                Foreign Physical Targets
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b text-sm divide-x font-black text-muted-400 uppercase">
                                        <th className="py-4 px-4 w-64">
                                            Components
                                        </th>
                                        {["PS", "MOOE", "CO", "FINEX"].map(
                                            (ec) => (
                                                <th
                                                    key={ec}
                                                    className="px-2 text-center  min-w-[180px]"
                                                >
                                                    {ec}
                                                </th>
                                            ),
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted-50">
                                    {data.foreign_physical_targets.map(
                                        (phys: any, i: any) => (
                                            <tr
                                                key={i}
                                                className="hover:bg-muted-50/30 divide-x transition-colors group"
                                            >
                                                <td className="py-3 px-4 align-top">
                                                    {phys.name}
                                                </td>
                                                {[
                                                    "PS",
                                                    "MOOE",
                                                    "CO",
                                                    "FINEX",
                                                ].map((ec) => {
                                                    const getCost = (
                                                        cat: "LP" | "GOP",
                                                        method?:
                                                            | "cash"
                                                            | "non_cash",
                                                    ) =>
                                                        phys.costs?.find(
                                                            (c: any) =>
                                                                c.expense_class ===
                                                                    ec &&
                                                                c.fund_category ===
                                                                    cat &&
                                                                (cat !== "LP" ||
                                                                    c.fund_method ===
                                                                        method),
                                                        )?.amount || "";

                                                    const lpCash = Number(
                                                        getCost("LP", "cash") ||
                                                            0,
                                                    );
                                                    const lpNonCash = Number(
                                                        getCost(
                                                            "LP",
                                                            "non_cash",
                                                        ) || 0,
                                                    );
                                                    const gop = Number(
                                                        getCost("GOP") || 0,
                                                    );
                                                    const cellTotal =
                                                        lpCash +
                                                        lpNonCash +
                                                        gop;
                                                    return (
                                                        <td
                                                            key={ec}
                                                            className="p-3  align-top min-w-[160px]"
                                                        >
                                                            <div className="flex flex-col gap-2">
                                                                {/* LP Cash Input */}
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-bold text-muted-500 w-12">
                                                                        LP CASH
                                                                    </span>
                                                                    <div
                                                                        key={`${ec}-LP-CASH`}
                                                                        className="flex-1 text-right bg-white border border-muted-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 "
                                                                    >
                                                                        {getCost(
                                                                            "LP",
                                                                            "cash",
                                                                        )
                                                                            ? getCost(
                                                                                  "LP",
                                                                                  "cash",
                                                                              ).toLocaleString()
                                                                            : "-"}
                                                                    </div>
                                                                </div>

                                                                {/* LP Non-Cash Input */}
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-bold text-muted-500 w-12">
                                                                        LP
                                                                        NON-CASH
                                                                    </span>
                                                                    <div
                                                                        key={`${ec}-LP-NON-CASH`}
                                                                        className="flex-1 text-right bg-white border border-muted-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 "
                                                                    >
                                                                        {getCost(
                                                                            "LP",
                                                                            "non_cash",
                                                                        )
                                                                            ? getCost(
                                                                                  "LP",
                                                                                  "non_cash",
                                                                              ).toLocaleString()
                                                                            : "-"}
                                                                    </div>
                                                                </div>

                                                                {/* GOP Input */}
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-bold text-muted-500 w-12">
                                                                        GOP
                                                                    </span>
                                                                    <div
                                                                        key={`${ec}-GOP`}
                                                                        className="flex-1 text-right bg-white border border-muted-200 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 "
                                                                    >
                                                                        {getCost(
                                                                            "GOP",
                                                                            "cash",
                                                                        )
                                                                            ? getCost(
                                                                                  "GOP",
                                                                                  "cash",
                                                                              ).toLocaleString()
                                                                            : "-"}
                                                                    </div>
                                                                </div>

                                                                {/* Sub-total for this Expense Class */}
                                                                <div className="mt-1 pt-1 border-t border-dashed border-muted-200 flex justify-between items-center">
                                                                    <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-400">
                                                                        Total
                                                                    </span>
                                                                    <span className="text-sm font-mono font-bold text-blue-600">
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
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* SIGN SECTION */}
            <SignSection
                formId={data.id ?? ""}
                tableName="project_proposals" // Fixed: Ensure this matches your DB table
                formData={data}
                userId={session.user.id}
                entityId={data.entity_id}
                authStatus={data.auth_status ?? ""}
                statusMessage={signSectionStatusMessage}
                userInWorkflow={userInWorkflow}
                userCanSign={canSignCurrentVersion && !existingSignature}
                signatoryRole={
                    existingSignature
                        ? existingSignature.role
                        : (currentSignatoryRole ?? "")
                }
                alreadySigned={!!existingSignature}
                signatories={allSignatures}
                pastSignatories={pastSignatures}
                latestRejection={latestRejection}
                workflow={PROPOSAL_WORKFLOW}
            />

            {/* DANGER ZONE */}
            {data.auth_status === "draft" && !familyHasApprovedVersion && (
                <div className="pt-6 border-t mt-12 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">
                            Danger Zone
                        </h3>
                        <p className="text-sm text-gray-500">
                            Irreversible actions for this record.
                        </p>
                    </div>
                    <FormDeleteButton
                        id={data.id}
                        onDelete={deleteFormAction}
                    />
                </div>
            )}
        </div>
    );
}