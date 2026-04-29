"use client";

import { SignSection } from "@/components/ui/digital-signatures/SignSection";
import { Badge } from "@/components/ui/badge";
import FormDeleteButton from "@/components/ui/FormDeleteButton";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { STAFFING_WORKFLOW } from "@/src/lib/workflows/staffing-flow";
import BackButton from "../BackButton";
import { STATUS_BADGE_COLORS, STATUS_LABELS } from "@/src/lib/constants"
import { VALID_COMPENSATION_NAMES } from "@/src/lib/constants";

const staffTypes = ["Casual", "Contractual", "Part-Time", "Substitute"];

interface StaffingViewProps {
    summary: any
    paps: any[]
    session: any
    backUrl: string
    isDbmEvaluator?: boolean
    originalFormId: string
    versionTabs: {
        id: string
        version: number
        parent_form_id: string | null
        auth_status: string | null
        updated_at: Date
    }[]
    workflowData: {
        userCanSign: boolean
        currentSignatoryRole: string | null
        existingSignature: any
        allSignatures: any[]
        pastSignatures: {
            id: string
            user_name: string
            role: string
            created_at: Date
        }[]
        latestRejection: {
            remarks: string | null
            changed_at: Date
            user_name: string | null
        } | null
    };
    updateAuthStatus: () => Promise<void>
    deleteFormAction: (id: string) => Promise<void>
}

export default function StaffingView({
    summary,
    paps,
    session,
    backUrl,
    originalFormId,
    versionTabs,
    workflowData,
    updateAuthStatus,
    deleteFormAction,
    isDbmEvaluator = false
}: StaffingViewProps) {
    const { userCanSign, currentSignatoryRole, existingSignature, allSignatures, pastSignatures, latestRejection } = workflowData;
    const formData = { id: summary.id, fiscal_year: summary.fiscal_year, form_id: summary.id };
    const familyHasApprovedVersion = versionTabs.some(version => version.auth_status === 'approved')
    const canEditCurrentVersion =
        !familyHasApprovedVersion &&
        (
            (summary.auth_status === 'draft' && session.user.access_level === 'encode') ||
            (summary.auth_status === 'pending_dbm' && isDbmEvaluator)
        )
    const canSignCurrentVersion = !familyHasApprovedVersion && userCanSign
    const signSectionStatusMessage =
        familyHasApprovedVersion && summary.auth_status !== 'approved'
            ? 'DBM has already approved a different version of this form. This version is locked and can no longer be signed.'
            : undefined

    const allPositions = summary?.positions || [];

    const overallBasicSalary = allPositions.reduce((sum: number, pos: any) => sum + (Number(pos.total_salary) || 0), 0);

    const overallCompensationTotals = VALID_COMPENSATION_NAMES.map(compName => {
        return allPositions.reduce((sum: number, pos: any) => {
            const compMatch = pos.compensations?.find((c: any) => c.name.trim().toLowerCase() === compName.trim().toLowerCase());
            return sum + (compMatch ? Number(compMatch.amount) : 0);
        }, 0);
    });

    const overallGrandTotal = overallBasicSalary + overallCompensationTotals.reduce((a: number, b: number) => a + b, 0);

    const renderStaffTypeGroup = (tier: number, type: string) => {
        const filteredPositions = (summary?.positions || []).filter((pos: any) => {
            const pap = paps.find((p: any) => p.id === pos.pap_id);
            return pap?.tier === tier && pos.staff_type === type;
        });

        if (filteredPositions.length === 0) return null;

        const totalBasicSalary = filteredPositions.reduce((sum: number, pos: any) => sum + (Number(pos.total_salary) || 0), 0);

        const compensationTotals = VALID_COMPENSATION_NAMES.map(compName => {
            return filteredPositions.reduce((sum: number, pos: any) => {
                const compMatch = pos.compensations?.find((c: any) => c.name.trim().toLowerCase() === compName.trim().toLowerCase());
                return sum + (compMatch ? Number(compMatch.amount) : 0);
            }, 0);
        });

        const grandTotal = totalBasicSalary + compensationTotals.reduce((a, b) => a + b, 0);

        return (
            <div key={type} className="space-y-2">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-tighter bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200">
                    {type} Positions
                </h4>
                
                <div className="border border-slate-300 rounded-lg overflow-x-auto bg-white shadow-sm">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-100 text-sm font-bold text-slate-700 uppercase">
                            <tr>
                                <th className="p-2 text-left sticky left-0 bg-slate-100 z-10 border-r border-b border-slate-300 min-w-[220px]">Position / Program</th>
                                <th className="p-2 text-center border-r border-b border-slate-300">Months</th>
                                <th className="p-2 text-center border-r border-b border-slate-300">Qty</th>
                                <th className="p-2 text-center border-r border-b border-slate-300">SG</th>
                                <th className="p-2 text-right border-r border-b border-slate-300">Basic Salary</th>
                                
                                {VALID_COMPENSATION_NAMES.map(name => (
                                    <th key={name} className="p-2 text-right border-r border-b border-slate-300 font-bold">
                                        {name}
                                    </th>
                                ))}
                                
                                <th className="p-2 text-right border-b border-slate-300 font-bold text-slate-900 bg-slate-200">
                                    Total (₱)
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300">
                            {filteredPositions.map((pos: any) => {
                                const relatedPap = paps.find((p: any) => p.id === pos.pap_id);
                                const rowBasic = Number(pos.total_salary) || 0;
                                let rowCompensationsTotal = 0;

                                return (
                                    <tr key={pos.id} className="hover:bg-accent-foreground/10 transition-colors">
                                        <td className="p-2 sticky left-0 bg-white border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <div className="font-bold text-slate-900 leading-tight">{pos.position_title}</div>
                                            <div className="text-sm text-slate-500 mt-0.5 uppercase">{relatedPap?.title}</div>
                                        </td>
                                        <td className="p-2 text-center border-r border-slate-200 text-slate-600">{pos.months_employed}</td>
                                        <td className="p-2 text-center border-r border-slate-200 font-mono">{pos.num_positions}</td>
                                        <td className="p-2 text-center border-r border-slate-200 font-mono">{pos.salary_grade}</td>
                                        <td className="p-2 text-right border-r border-slate-200 font-mono">
                                            ₱{rowBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>

                                        {VALID_COMPENSATION_NAMES.map(compName => {
                                            const compMatch = pos.compensations?.find(
                                                (c: any) => c.name.trim().toLowerCase() === compName.trim().toLowerCase()
                                            );
                                            const amount = compMatch ? Number(compMatch.amount) : 0;
                                            rowCompensationsTotal += amount;

                                            return (
                                                <td key={compName} className={`p-2 text-right border-r border-slate-200 font-mono text-sm ${amount === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    {amount > 0 ? "₱" + amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                                </td>
                                            );
                                        })}

                                        <td className="p-2 text-right border-slate-200 font-mono font-bold text-slate-900 bg-slate-50">
                                            ₱{(rowBasic + rowCompensationsTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>

                        <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400">
                            <tr>
                                <td colSpan={4} className="p-2 text-right border-r border-slate-300 uppercase text-sm tracking-wider">
                                    Subtotal
                                </td>
                                <td className="p-2 text-right border-r border-slate-300 font-mono text-secondary-foreground">
                                    ₱{totalBasicSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                {compensationTotals.map((compTotal, i) => (
                                    <td key={`total-${i}`} className={`p-2 text-right border-r border-slate-300 font-mono text-sm ${compTotal === 0 ? 'text-slate-400' : 'text-secondary-foreground'}`}>
                                        {compTotal > 0 ? "₱" + compTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                    </td>
                                ))}
                                <td className="p-2 text-right font-mono bg-slate-200 text-secondary-foreground border-slate-300 text-sm">
                                    ₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <main className="m-6 max-w-none px-4 md:px-8 md:my-12 space-y-8">
            <div className="flex justify-between items-center mb-6">
                <BackButton url={backUrl} label="Back"></BackButton>
                {canEditCurrentVersion && (
                    <div className="flex flex-row gap-2">
                        <Link 
                            href={`/forms/staff/${formData.id}/edit`}
                            className="flex items-center gap-2 bg-accent-foreground hover:bg-accent-foreground/80 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all shadow-sm"
                        >
                            <Pencil size={14} />
                            {session.user.role !== 'dbm' ? 'Edit Form' : 'Overwrite Form'}
                        </Link>
                        
                        <div className="flex justify-end gap-2">
                            <form action={updateAuthStatus}>
                                <button type="submit" className="bg-secondary-foreground text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-secondary-foreground/80">Submit Form</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            <div className="justify-center">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">FY {summary.fiscal_year} Staffing Plan</h1>
                    <Badge
                        variant={STATUS_BADGE_COLORS[summary.auth_status ?? 'draft'] ?? 'default'}
                        className="mt-2 py-1.5 px-4 rounded-full"
                    >
                        {STATUS_LABELS[summary.auth_status ?? ""] ?? summary.auth_status}
                    </Badge>
                </div>
            </div>

            {versionTabs.length > 1 && (
                <section className="space-y-3">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {versionTabs.map((versionTab) => {
                            const isActive = versionTab.id === summary.id
                            const isOriginal = versionTab.id === originalFormId

                            return (
                                <Link
                                    key={versionTab.id}
                                    href={`/forms/staff/${versionTab.id}`}
                                    className={`min-w-[168px] rounded-xl border px-4 py-3 text-left transition-colors ${
                                        isActive
                                            ? 'border-accent-foreground bg-accent-foreground/10 text-accent-foreground'
                                            : 'border-border bg-card hover:border-accent-foreground/40 hover:bg-accent/40'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-bold">
                                            {isOriginal ? `Original (v${versionTab.version})` : `DBM (v${versionTab.version})` || `v${versionTab.version}`}
                                        </span>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {STATUS_LABELS[versionTab.auth_status ?? "draft"] ?? versionTab.auth_status}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Updated {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(versionTab.updated_at))}
                                    </p>
                                </Link>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* Staff Per Tier */}
            <section className="space-y-10">
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-accent-foreground border-l-4 border-accent-foreground pl-3 py-1 bg-accent-foreground/10">TIER 1: ONGOING PROGRAMS</h3>
                    <div className="space-y-6">
                        {staffTypes.map(type => renderStaffTypeGroup(1, type))}
                    </div>
                </div>
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-secondary-foreground border-l-4 border-secondary-foreground pl-3 py-1 bg-secondary-foreground/10">TIER 2: NEW PROPOSALS</h3>
                    <div className="space-y-6">
                        {staffTypes.map(type => renderStaffTypeGroup(2, type))}
                    </div>
                </div>
            </section>

            {/* Total */}
            <div className="mt-6 border-2 border-black rounded-xl overflow-hidden bg-white shadow-md">
                <div className="bg-accent-foreground text-white p-3 border-b border-slate-700">
                    <h3 className="text-sm font-black tracking-widest uppercase">Total Budget Requirement (All Tiers & Types)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-50 text-sm font-bold text-slate-700 uppercase">
                            <tr>
                                <th className="p-3 text-left border-r border-b border-slate-300 min-w-[220px]">Requirement Summary</th>
                                <th className="p-3 text-right border-r border-b border-slate-300">Total Basic Salary</th>
                                {VALID_COMPENSATION_NAMES.map(name => (
                                    <th key={`overall-th-${name}`} className="p-3 text-right border-r border-b border-slate-300 font-bold">
                                        {name}
                                    </th>
                                ))}
                                <th className="p-3 text-right border-b border-slate-300 font-black text-secondary-foreground bg-slate-200">
                                    GRAND TOTAL (₱)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-3 font-bold text-slate-900 border-r border-slate-300 bg-slate-50 uppercase tracking-tight text-sm">
                                    Entire Staffing Plan
                                </td>
                                <td className="p-3 text-right font-mono border-r border-slate-300 font-bold text-slate-700">
                                    ₱{overallBasicSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                {overallCompensationTotals.map((compTotal, i) => (
                                    <td key={`overall-td-${i}`} className={`p-3 text-right border-r border-slate-300 font-mono text-sm ${compTotal === 0 ? 'text-slate-400' : 'font-bold'}`}>
                                        {compTotal > 0 ? "₱" + compTotal.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                    </td>
                                ))}
                                <td className="p-3 text-right font-mono font-black text-lg text-secondary-foreground bg-secondary-foreground/10 border-slate-300">
                                    ₱{overallGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <SignSection 
                formId={summary.id ?? ""} 
                tableName={'staffing_summaries'} 
                formData={summary} 
                userId={session.user.id} 
                entityId={summary.entity_id}
                authStatus={summary.auth_status ?? ""} 
                statusMessage={signSectionStatusMessage}
                userCanSign={canSignCurrentVersion && !existingSignature}
                signatoryRole={existingSignature ? existingSignature.role : (currentSignatoryRole ?? "")}
                alreadySigned={!!existingSignature}
                signatories={allSignatures}
                pastSignatories={pastSignatures}
                latestRejection={latestRejection}
                workflow={STAFFING_WORKFLOW}
            />

            {summary.auth_status === 'draft' && (
                <div className="pt-6 border-t mt-12 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Danger Zone</h3>
                        <p className="text-sm text-gray-500">Irreversible actions for this record.</p>
                    </div>
                    <FormDeleteButton id={summary.id} onDelete={deleteFormAction} />
                </div>
            )}
        </main>
    );
}
