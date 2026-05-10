"use client";

import { Badge } from "@/components/ui/badge";
import { SignSection } from "@/components/ui/digital-signatures/SignSection";
import Link from "next/link";
import { Pencil } from "lucide-react";
import FormDeleteButton from "../FormDeleteButton";
import { RETIREE_WORKFLOW } from "@/src/lib/workflows/retiree-flow";
import BackButton from "../BackButton";
import { STATUS_BADGE_COLORS, STATUS_LABELS } from "@/src/lib/constants";
import BudgetPrepClosedBanner from "@/components/ui/BudgetPrepClosedBanner";
import CollapsibleRemarksSection from "@/components/ui/remarks/CollapsibleRemarksSection";

type RetireeRowView = {
    id: string
    name: string
    is_gsis_member: boolean
    retirement_law: string
    position: string
    salary_grade: number
    highest_monthly_salary: number | string
    tlb_amount: number | null
    rg_amount: number | null
    date_of_birth: Date | string
    original_appointment: Date | string
    retirement_effectivity: Date | string
    number_vacation_leave: number | null
    number_sick_leave: number | null
    total_credible_service: number | null
    number_gratuity_months: number | null
}

type RetireeFormView = {
    id: string
    fiscal_year: number
    is_mandatory: boolean
    entity_id: string
    auth_status: string | null
    retirees: RetireeRowView[]
}

type SessionLike = {
    user: {
        id: string
        role: string
        access_level: string
    }
}

type SignatorySummary = {
    id: string
    user_name: string
    role: string
    created_at: Date
}

type ExistingSignature = {
    role: string
} | null

interface RetireeViewProps {
    data: RetireeFormView;
    session: SessionLike;
    backUrl: string;
    isDbmEvaluator?: boolean;
    budgetPrepClosedForEntityActions?: boolean;
    allowClosedCycleActions?: boolean;
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
    currentSignatoryRole: string | null;
    existingSignature: ExistingSignature;
    allSignatures: SignatorySummary[];
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
    ownerEntityName: string;
    overrideHistory: {
        id: string;
        target_record_id: string;
        overridden_by_name: string | null;
        justification_remark: string;
        legal_directive_ref: string | null;
        created_at: Date;
    }[];
    updateAuthStatus: () => Promise<void>;
    deleteFormAction: (id: string) => Promise<void>;
}

export default function RetireeView({
    data,
    session,
    backUrl,
    isDbmEvaluator = false,
    budgetPrepClosedForEntityActions = false,
    allowClosedCycleActions = false,
    originalFormId,
    versionTabs,
    userInWorkflow,
    userCanSign,
    currentSignatoryRole,
    existingSignature,
    allSignatures,
    pastSignatures,
    latestRejection,
    ownerEntityName,
    overrideHistory,
    updateAuthStatus,
    deleteFormAction,
}: RetireeViewProps) {
    const formData = {
        id: data.id,
        fiscal_year: data.fiscal_year,
        form_id: data.id,
    };
    const familyHasApprovedVersion = versionTabs.some(
        (version) => version.auth_status === "approved",
    );
    const canEditCurrentVersion =
        !familyHasApprovedVersion &&
        ((data.auth_status === "draft" &&
            session.user.access_level === "encode" &&
            !budgetPrepClosedForEntityActions) ||
            (data.auth_status === "pending_dbm" &&
                isDbmEvaluator &&
                allowClosedCycleActions));
    const canSignCurrentVersion = !familyHasApprovedVersion && userCanSign;
    const signSectionStatusMessage =
        budgetPrepClosedForEntityActions
            ? "The budget preparation phase for this fiscal year is closed. Entity users can no longer edit, submit, or sign this form."
            : familyHasApprovedVersion && data.auth_status !== "approved"
            ? "DBM has already approved a different version of this form. This version is locked and can no longer be signed."
            : undefined;

    return (
        <main className="p-6 max-w-7xl mx-auto space-y-6">
            {budgetPrepClosedForEntityActions && (
                <BudgetPrepClosedBanner message="The budget preparation phase for this fiscal year is over. You can no longer edit, submit, or sign this form until DBM reopens the cycle for this fiscal year." />
            )}
            <div className="flex justify-between items-center mb-6">
                <BackButton url={backUrl} label="Back" />
                {canEditCurrentVersion && (
                    <div className="flex flex-row gap-2">
                        <Link
                            href={`/forms/retirees/${formData.id}/edit`}
                            className="flex items-center gap-2 bg-accent-foreground hover:bg-accent-foreground/80 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all shadow-sm"
                        >
                            <Pencil size={14} />
                            {session.user.role !== "dbm"
                                ? "Edit Form"
                                : "Overwrite Form"}
                        </Link>

                        {session.user.role !== 'dbm' && (
                            <div className="flex justify-end gap-2">
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
                )}
            </div>
            <div className="justify-center">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">
                        FY {data.fiscal_year} Retiree List Details
                    </h1>
                    <Badge
                        variant={
                            STATUS_BADGE_COLORS[data.auth_status ?? "draft"] ??
                            "default"
                        }
                        className="mt-2 py-1.5 px-4 rounded-full"
                    >
                        {STATUS_LABELS[data.auth_status ?? ""] ??
                            data.auth_status}
                    </Badge>
                </div>
            </div>

            {versionTabs.length > 1 && (
                <section className="space-y-3">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {versionTabs.map((versionTab) => {
                            const isActive = versionTab.id === data.id;
                            const isOriginal = versionTab.id === originalFormId;

                            return (
                                <Link
                                    key={versionTab.id}
                                    href={`/forms/retirees/${versionTab.id}`}
                                    className={`min-w-[168px] rounded-xl border px-4 py-3 text-left transition-colors ${
                                        isActive
                                            ? "border-accent-foreground bg-accent-foreground/10 text-accent-foreground"
                                            : "border-border bg-card hover:border-accent-foreground/40 hover:bg-accent/40"
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-bold">
                                            {isOriginal
                                                ? `Original (v${versionTab.version})`
                                                : `DBM (v${versionTab.version})`}
                                        </span>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {STATUS_LABELS[
                                                versionTab.auth_status ??
                                                    "draft"
                                            ] ?? versionTab.auth_status}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Updated{" "}
                                        {new Intl.DateTimeFormat("en-PH", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        }).format(
                                            new Date(versionTab.updated_at),
                                        )}
                                    </p>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            )}

            {overrideHistory.length > 0 && (
                <CollapsibleRemarksSection
                    title="DBM Override Remarks"
                    description="Review the reasons recorded for each DBM overwrite on this form family."
                    items={overrideHistory}
                    renderItem={(entry, index) => (
                        <div
                            key={entry.id}
                            className={`bg-card px-5 py-4 ${index === overrideHistory.length - 1 ? "" : "border-b border-border"}`}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-secondary-foreground">
                                    {entry.overridden_by_name || "DBM"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {new Date(entry.created_at).toLocaleString()}
                                </div>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm">
                                {entry.justification_remark}
                            </p>
                            {entry.legal_directive_ref && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Reference: {entry.legal_directive_ref}
                                </p>
                            )}
                        </div>
                    )}
                />
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 border rounded-lg shadow-sm">
                    <label className="text-[10px] uppercase font-bold text-slate-400">
                        Fiscal Year
                    </label>
                    <p className="text-lg font-semibold">{data.fiscal_year}</p>
                </div>
                <div className="bg-white p-4 border rounded-lg shadow-sm">
                    <label className="text-[10px] uppercase font-bold text-slate-400">
                        Submission Type
                    </label>
                    <p className="text-lg font-semibold">
                        {data.is_mandatory ? "Mandatory" : "Optional"}
                    </p>
                </div>
                <div className="bg-white p-4 border rounded-lg shadow-sm">
                    <label className="text-[10px] uppercase font-bold text-slate-400">
                        Entity
                    </label>
                    <p className="text-lg font-semibold text-sm">
                        {ownerEntityName}
                    </p>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-accent-foreground text-white font-medium border-b text-s uppercase">
                            <tr>
                                <th className="px-3 py-3 border-r w-10 text-center">
                                    #
                                </th>
                                <th className="px-3 py-3 border-r min-w-[200px]">
                                    Personnel Details
                                </th>
                                <th className="px-3 py-3 border-r text-center">
                                    Law / GSIS
                                </th>
                                <th className="px-3 py-3 border-r text-center">
                                    Leave Credits (V/S)
                                </th>
                                <th className="px-3 py-3 border-r text-center">
                                    Service / Gratuity
                                </th>
                                <th className="px-3 py-3 border-r text-center">
                                    Dates (DOB/Eff)
                                </th>
                                <th className="px-3 py-3 border-r text-right">
                                    Monthly Salary
                                </th>
                                <th className="px-3 py-3 border-r text-right">
                                    Terminal Leave Amount
                                </th>
                                <th className="px-3 py-3 text-right">
                                    Retirement Gratuity Amount
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.retirees.map(
                                (retiree: RetireeRowView, index: number) => (
                                    <tr
                                        key={retiree.id}
                                        className="hover:bg-slate-50/50"
                                    >
                                        <td className="px-3 py-3 border-r text-center text-slate-400 font-mono text-s">
                                            {index + 1}
                                        </td>

                                        {/* Column 1: Name & Position */}
                                        <td className="px-3 py-3 border-r">
                                            <div className="font-bold text-slate-900">
                                                {retiree.name}
                                            </div>
                                            <div className="text-[11px] text-secondary-foreground font-medium uppercase">
                                                SG {retiree.salary_grade} —{" "}
                                                {retiree.position}
                                            </div>
                                        </td>

                                        {/* Column 2: Law & GSIS */}
                                        <td className="px-3 py-3 border-r text-center space-y-1">
                                            <div className="text-s font-semibold">
                                                {retiree.retirement_law}
                                            </div>
                                            <Badge
                                                variant={
                                                    retiree.is_gsis_member
                                                        ? "secondary"
                                                        : "outline"
                                                }
                                                className="text-xs bg-gray-200 text-accent-foreground"
                                            >
                                                {retiree.is_gsis_member
                                                    ? "GSIS MEMBER"
                                                    : "NON-GSIS"}
                                            </Badge>
                                        </td>

                                        {/* Column 3: Leave Credits */}
                                        <td className="px-3 py-3 border-r text-center space-y-1">
                                            <div className="text-s">
                                                {retiree.number_vacation_leave} VLs
                                            </div>
                                            <div className="text-s">
                                                {retiree.number_sick_leave} SLs
                                            </div>
                                        </td>

                                        {/* Column 4: Service & Gratuity */}
                                        <td className="px-3 py-3 border-r text-center">
                                            <div className="text-s">
                                                {retiree.total_credible_service ??
                                                    "0"}{" "}
                                                Years
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {retiree.number_gratuity_months ??
                                                    "0"}{" "}
                                                Mos. Gratuity
                                            </div>
                                        </td>

                                        {/* Column 5: DOB & EFF */}
                                        <td className="px-3 py-3 border-r text-center">
                                            <div className="text-s">
                                                DOB: {new Date(
                                                    retiree.date_of_birth,
                                                ).toLocaleDateString()}
                                            </div>
                                            <div className="text-s">
                                                EFF: {new Date(
                                                    retiree.retirement_effectivity,
                                                ).toLocaleDateString()}
                                            </div>
                                        </td>

                                        {/* Column 6: Salary */}
                                        <td className="px-3 py-3 border-r text-right font-mono text-slate-900 font-bold">
                                            ₱
                                            {Number(
                                                retiree.highest_monthly_salary,
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                            })}
                                        </td>

                                        {/* Column 7: Terminal Leave */}
                                        <td className="px-3 py-3 border-r text-right font-mono text-slate-900 font-bold">
                                            ₱
                                            {Number(
                                                retiree.tlb_amount,
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                            })}
                                        </td>

                                        {/* Column 8: Retirement Gratuity Amount */}
                                        <td className="px-3 py-3 text-right font-mono text-slate-900 font-bold">
                                            ₱
                                            {Number(
                                                retiree.rg_amount,
                                            ).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                            })}
                                        </td>
                                    </tr>
                                ),
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t">
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-3 text-right uppercase text-s"
                                >
                                    Total Monthly Requirement
                                </td>
                                <td className="px-4 py-3 text-right text-lg text-accent-foreground font-mono">
                                    ₱
                                    {data.retirees
                                        .reduce(
                                            (sum: number, r: RetireeRowView) =>
                                                sum +
                                                Number(
                                                    r.highest_monthly_salary,
                                                ) +
                                                Number(r.tlb_amount) +
                                                Number(r.rg_amount),
                                            0,
                                        )
                                        .toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                        })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <SignSection
                formId={data.id ?? ""}
                tableName="retirees_list"
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
                allowClosedCycleAction={allowClosedCycleActions}
                workflow={RETIREE_WORKFLOW}
            />
            {data.auth_status === "draft" &&
                !familyHasApprovedVersion &&
                !budgetPrepClosedForEntityActions && (
                <div className="pt-6 border-t mt-12 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">
                            Danger Zone
                        </h3>
                        <p className="text-xs text-gray-500">
                            Irreversible actions for this record.
                        </p>
                    </div>
                    <FormDeleteButton
                        id={data.id}
                        onDelete={deleteFormAction}
                    />
                </div>
            )}
        </main>
    );
}
