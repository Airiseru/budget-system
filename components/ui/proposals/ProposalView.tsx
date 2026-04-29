"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { SignSection } from "@/components/ui/digital-signatures/SignSection";
import { PROPOSAL_WORKFLOW } from "@/src/lib/workflows/proposal-flow";
import Link from "next/link";
import {
    ArrowLeft,
    Pencil,
    MapPin,
    Target,
    Landmark,
    FileText,
    Gavel,
} from "lucide-react";

interface ProposalViewProps {
    data: any;
    session: any;
    userCanSign: boolean;
    currentSignatoryRole: string | null;
    existingSignature: any;
    allSignatures: any[];
    updateAuthStatus: () => Promise<void>;
    deleteFormAction: (id: string) => Promise<void>;
}

const EXPENSE_CLASSES = ["PS", "MOOE", "CO", "FE"];

const CostBreakdownColumns = ({ item }: { item: any }) => {
    if (!item.costs || item.costs.length === 0) {
        return (
            <td className="p-4 text-center col-span-4 text-muted-400 italic text-[10px]">
                No financial data recorded
            </td>
        );
    }

    return (
        <>
            {EXPENSE_CLASSES.map((cls) => {
                const costEntry = item.costs?.find(
                    (c: any) => c.expense_class === cls,
                );
                return (
                    <td
                        key={cls}
                        className="p-4 text-right border-l font-mono text-xs"
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
            return "bg-green-100 text-green-700 hover:bg-green-100 border-green-200";
        case "False":
            return "bg-red-100 text-red-700 hover:bg-red-100 border-red-200";
        case "Not Applicable":
            return "bg-slate-100 text-slate-500 hover:bg-slate-100 border-slate-200";
        default:
            return "bg-slate-100 text-slate-500 hover:bg-slate-100";
    }
};

export default function ProposalView({
    data,
    session,
    userCanSign,
    currentSignatoryRole,
    existingSignature,
    allSignatures,
    updateAuthStatus,
    deleteFormAction,
}: ProposalViewProps) {
    const getAttributionRows = (attributions: any[]) => {
        const rows: any[] = [];

        attributions?.forEach((attr) => {
            // We need a row for every unique expense class found in this attribution
            const uniqueClasses = new Set<string>();
            attr.costs?.forEach((c: any) =>
                c.expense_classes?.forEach((ec: any) =>
                    uniqueClasses.add(ec.expense_class),
                ),
            );

            Array.from(uniqueClasses)
                .sort()
                .forEach((cls) => {
                    rows.push({
                        description: attr.description,
                        expenseClass: cls,
                        // Helper to find specific cell value
                        getValue: (year: number, tier: number | null) => {
                            const yearData = attr.costs?.find(
                                (c: any) =>
                                    c.year === year &&
                                    (tier === null || c.tier === tier),
                            );
                            const classData = yearData?.expense_classes?.find(
                                (ec: any) => ec.expense_class === cls,
                            );
                            return Number(classData?.amount || 0);
                        },
                    });
                });
        });

        return rows;
    };

    const getGroupedData = (attributions: any[]) => {
        return attributions?.map((attr) => {
            // Get unique expense classes for this specific PAP
            const classes = new Set<string>();
            attr.costs?.forEach((c: any) =>
                c.expense_classes?.forEach((ec: any) =>
                    classes.add(ec.expense_class),
                ),
            );

            return {
                description: attr.description,
                expenseClasses: Array.from(classes).sort(),
                // Helper to pull specific values from the nested JSON
                getValue: (cls: string, year: number, tier: number | null) => {
                    const yearData = attr.costs?.find(
                        (c: any) =>
                            c.year === year &&
                            (tier === null || c.tier === tier),
                    );
                    const classData = yearData?.expense_classes?.find(
                        (ec: any) => ec.expense_class === cls,
                    );
                    return Number(classData?.amount || 0);
                },
            };
        });
    };

    const groupedPaps = getGroupedData(data.local_financial_attributions);

    return (
        <div className="m-6 max-w-5xl mx-auto space-y-10 pb-20">
            {/* NAVIGATION & ACTIONS */}
            <div className="flex justify-between items-center mb-6">
                <Link
                    href="/forms/proposals"
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to List
                </Link>
                {data.auth_status === "draft" && (
                    <div className="flex flex-row gap-2">
                        <Link
                            href={`/forms/proposals/${data.id}/edit`}
                            className="flex items-center gap-2 bg-secondary-foreground hover:bg-secondary-foreground/80 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all shadow-sm"
                        >
                            <Pencil size={14} />
                            Edit Form
                        </Link>
                        <form action={updateAuthStatus}>
                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold text-sm transition-all"
                            >
                                Submit Form
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* HEADER: TITLE & CORE STATS */}
            <header className="border-b pb-8">
                <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                        <Badge
                            variant="outline"
                            className="mb-2 uppercase tracking-widest text-[10px]"
                        >
                            BP Form {data.type}
                        </Badge>
                        <h1 className="text-4xl font-black tracking-tighter text-muted-900 uppercase">
                            {data.title || "Untitled Project Proposal"}
                        </h1>
                        <p className="text-muted-500 font-medium flex items-center gap-2">
                            Fiscal Year {data.proposal_year} •{" "}
                            {data.is_new ? "New Project" : "Expanded Project"}
                        </p>
                    </div>
                    <Badge className="px-6 py-2 text-sm uppercase bg-muted-900">
                        {data.auth_status?.replace("_", " ")}
                    </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="p-4 bg-muted-50 rounded-xl border border-muted-100">
                        <p className="text-[10px] font-bold text-muted-400 uppercase">
                            Total Proposal Cost
                        </p>
                        <p className="text-2xl font-mono font-black text-muted-800">
                            {data.total_proposal_currency}{" "}
                            {Number(data.total_proposal_cost).toLocaleString()}
                        </p>
                    </div>
                    <div className="p-4 bg-muted-50 rounded-xl border border-muted-100">
                        <p className="text-[10px] font-bold text-muted-400 uppercase">
                            Priority Rank
                        </p>
                        <p className="text-2xl font-black text-muted-800">
                            #{data.priority_rank}
                        </p>
                    </div>
                    <div className="p-4 bg-muted-50 rounded-xl border border-muted-100">
                        <p className="text-[10px] font-bold text-muted-400 uppercase">
                            Sector Classification
                        </p>
                        <p className="text-sm font-bold text-muted-800">
                            {data.is_infrastructure
                                ? "Infrastructure"
                                : "Non-Infrastructure"}
                            {data.for_ict && " • ICT"}
                        </p>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT GRID */}
            <div className="flex flex-col gap-10">
                {/* Prerequisites */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-muted-400 tracking-widest flex items-center gap-2">
                        <Landmark size={14} /> Prerequisites
                    </h3>
                    <section className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
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
                                                <p className="text-xs font-bold text-muted-700">
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
                                            <p className="text-[10px] text-muted-500 mt-1 italic">
                                                Remarks: {pre.remarks}
                                            </p>
                                        </div>
                                    ),
                            )}
                        </div>
                    </section>
                    <section className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
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
                                                <p className="text-xs font-bold text-muted-700">
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
                                            <p className="text-[10px] text-muted-500 mt-1 italic">
                                                Remarks: {pre.remarks}
                                            </p>
                                        </div>
                                    ),
                            )}
                        </div>
                    </section>
                </div>

                {/* Core Components */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-muted-400 tracking-widest">
                        Cost by Components
                    </h3>
                    <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
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
                            <tbody className="divide-y">
                                {data.cost_by_components?.map(
                                    (comp: any, i: number) => (
                                        <tr key={i}>
                                            <td className="p-4 font-medium text-muted-700">
                                                {comp.component_name}
                                            </td>

                                            <CostBreakdownColumns item={comp} />
                                        </tr>
                                    ),
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* FORM 202 SPECIFIC: LOCAL DETAILS */}
            {data.type === "202" && (
                <div className="space-y-8">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-muted-800 uppercase italic">
                            Local Details
                        </h2>
                        <div className="h-px bg-muted-200 flex-grow" />
                    </div>

                    {/* PAP Attribution Section */}
                    <div className="space-y-4 mt-8">
                        <h3 className="text-xs font-black uppercase text-muted-400 tracking-widest">
                            PAP Attribution by Expense Class
                        </h3>
                        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th
                                            rowSpan={2}
                                            className="py-3 px-4 text-[10px] font-black text-muted-400 uppercase text-left border-r border-muted-100"
                                        >
                                            PAP Description / Expense Class
                                        </th>
                                        <th
                                            colSpan={3}
                                            className="py-2 px-2 text-[10px] font-black text-muted-400 uppercase text-center border-muted-100 border-r border-muted-100"
                                        >
                                            FY 2027
                                        </th>
                                        <th
                                            rowSpan={2}
                                            className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center border-r border-muted-100"
                                        >
                                            FY 2028 T1
                                        </th>
                                        <th
                                            rowSpan={2}
                                            className="py-3 px-2 text-[10px] font-black text-muted-400 uppercase text-center"
                                        >
                                            FY 2029 T1
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

                                        // 1. Extract and sort unique expense classes based on the preferred order
                                        const uniqueClasses = Array.from(
                                            new Set(
                                                attr.costs?.flatMap((c: any) =>
                                                    c.expense_classes?.map(
                                                        (ec: any) =>
                                                            ec.expense_class,
                                                    ),
                                                ),
                                            ),
                                        ).sort(
                                            (a: any, b: any) =>
                                                order.indexOf(a) -
                                                order.indexOf(b),
                                        ) as string[];

                                        // 2. Helper to get values for a specific class OR the entire PAP (if cls is null)
                                        const getVal = (
                                            year: number,
                                            tier: number | null,
                                            cls: string | null = null,
                                        ) => {
                                            const yData = attr.costs?.find(
                                                (c: any) =>
                                                    c.year === year &&
                                                    (tier === null ||
                                                        c.tier === tier),
                                            );
                                            if (!yData) return 0;

                                            if (cls) {
                                                return Number(
                                                    yData.expense_classes?.find(
                                                        (ec: any) =>
                                                            ec.expense_class ===
                                                            cls,
                                                    )?.amount || 0,
                                                );
                                            }
                                            // If no class specified, sum all classes for that year/tier (The PAP Total)
                                            return (
                                                yData.expense_classes?.reduce(
                                                    (sum: number, ec: any) =>
                                                        sum +
                                                        Number(ec.amount || 0),
                                                    0,
                                                ) || 0
                                            );
                                        };

                                        return (
                                            <tbody
                                                key={pIdx}
                                                className="border-b-2 border-chart-5/50"
                                            >
                                                {/* Header Row: PAP Description + Aggregated Totals */}
                                                <tr className="bg-muted-50/20 font-bold divide-x border-b border-chart-5/20">
                                                    <td className="p-4 text-muted-900 border-muted-100">
                                                        {attr.description}
                                                    </td>
                                                    <td className="p-4 text-right font-mono border-muted-50">
                                                        {getVal(
                                                            2027,
                                                            1,
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-mono border-r border-muted-100">
                                                        {getVal(
                                                            2027,
                                                            2,
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-mono bg-muted-100/20 border-r border-muted-100">
                                                        {(
                                                            getVal(2027, 1) +
                                                            getVal(2027, 2)
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-mono border-r border-muted-100">
                                                        {getVal(
                                                            2028,
                                                            1,
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right font-mono">
                                                        {getVal(
                                                            2029,
                                                            1,
                                                        ).toLocaleString()}
                                                    </td>
                                                </tr>

                                                {/* Child Rows: Individual Expense Classes */}
                                                {uniqueClasses.map((cls) => {
                                                    const v27t1 = getVal(
                                                        2027,
                                                        1,
                                                        cls,
                                                    );
                                                    const v27t2 = getVal(
                                                        2027,
                                                        2,
                                                        cls,
                                                    );
                                                    const v28t1 = getVal(
                                                        2028,
                                                        1,
                                                        cls,
                                                    );
                                                    const v29t1 = getVal(
                                                        2029,
                                                        1,
                                                        cls,
                                                    );

                                                    return (
                                                        <tr
                                                            key={cls}
                                                            className="hover:bg-muted-50/30 transition-colors"
                                                        >
                                                            <td className="p-3 pl-8 text-xs font-medium text-muted-500 border-r border-muted-100 italic">
                                                                {cls}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-xs text-muted-500 border-r border-muted-50">
                                                                {v27t1 > 0
                                                                    ? v27t1.toLocaleString()
                                                                    : "—"}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-xs text-muted-500 border-r border-muted-100">
                                                                {v27t2 > 0
                                                                    ? v27t2.toLocaleString()
                                                                    : "—"}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-xs text-muted-600 bg-muted-50/10 border-r border-muted-100">
                                                                {(
                                                                    v27t1 +
                                                                    v27t2
                                                                ).toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-xs text-muted-500 border-r border-muted-100">
                                                                {v28t1 > 0
                                                                    ? v28t1.toLocaleString()
                                                                    : "—"}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-xs text-muted-500">
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
                        <h3 className="text-xs font-black text-purple-600 uppercase flex items-center gap-2">
                            <MapPin size={12} /> Target Locations
                        </h3>
                        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                            <table className="border rounded-xl w-full bg-white overflow-hidden divide-y">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th className="py-3 px-4 text-[10px] font-black text-muted-400 uppercase w-1/3">
                                            Locations
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
                        <h4 className="text-xs font-black text-green-600 uppercase flex items-center gap-2">
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
                                        <span className="text-xs font-mono font-bold text-muted-400">
                                            FY {pt.year}
                                        </span>
                                    </div>
                                ),
                            )}
                        </div>
                    </div>

                    {/* Infrastructure Requirements */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-blue-600 uppercase">
                            Infrastructure Requirements
                        </h4>
                        <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-muted-50/50 border-b border-muted-100">
                                        <th className="py-3 px-4 text-[10px] font-black text-muted-400 uppercase w-1/3">
                                            Infrastructure Requirement
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

            {/* SIGNATURE SECTION */}
            <div className="pt-12 border-t">
                <SignSection
                    formId={data.id ?? ""}
                    tableName="project_proposals"
                    formData={{
                        id: data.id,
                        fiscal_year: data.proposal_year,
                        title: data.title,
                    }}
                    userId={session.user.id}
                    entityId={data.entity_id}
                    authStatus={data.auth_status ?? ""}
                    userCanSign={userCanSign}
                    signatoryRole={
                        existingSignature
                            ? existingSignature.role
                            : (currentSignatoryRole ?? "")
                    }
                    alreadySigned={!!existingSignature}
                    signatories={allSignatures}
                    workflow={PROPOSAL_WORKFLOW}
                />
            </div>
        </div>
    );
}
