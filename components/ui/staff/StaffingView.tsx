"use client";

import { SignSection } from "@/components/ui/digital-signatures/SignSection";
import { Badge } from "@/components/ui/badge";
import FormDeleteButton from "@/components/ui/FormDeleteButton";
import Link from "next/link";
import { Pencil, ArrowLeft } from "lucide-react";
import { STAFFING_WORKFLOW } from "@/src/lib/workflows/staffing-flow";
import BackButton from "../BackButton";

const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
    pending_agency_head: 'Pending Agency Head',
    approved: 'Approved',
};

const staffTypes = ["Casual", "Contractual", "Part-Time", "Substitute"];

const compensationNames = [
    'PERA', 'RATA', 'Clothing Allowance', 'Mid Year Bonus', 
    'End Year Bonus', 'Cash Gift', 'PEI', 'RLIP', 'Pag-IBIG', 'ECiP', 'PHIC'
];

interface StaffingViewProps {
    summary: any;
    paps: any[];
    session: any;
    workflowData: {
        userCanSign: boolean;
        currentSignatoryRole: string | null;
        existingSignature: any;
        allSignatures: any[];
    };
    // Server Actions passed as props
    updateAuthStatus: () => Promise<void>;
    deleteFormAction: (id: string) => Promise<void>;
}

export default function StaffingView({
    summary,
    paps,
    session,
    workflowData,
    updateAuthStatus,
    deleteFormAction
}: StaffingViewProps) {
    const { userCanSign, currentSignatoryRole, existingSignature, allSignatures } = workflowData;
    const formData = { id: summary.id, fiscal_year: summary.fiscal_year, form_id: summary.id };

    const renderStaffTypeGroup = (tier: number, type: string) => {
        const filteredPositions = (summary?.positions || []).filter((pos: any) => {
            const pap = paps.find((p: any) => p.id === pos.pap_id);
            return pap?.tier === tier && pos.staff_type === type;
        });

        if (filteredPositions.length === 0) return null;

        return (
            <div key={type} className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200">
                    {type} Positions
                </h4>
                
                {/* 1. Added border and rounded corners to the container */}
                <div className="border border-slate-300 rounded-lg overflow-x-auto bg-white shadow-sm">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                            <tr>
                                {/* 2. Added border-r (right) and border-b (bottom) to headers */}
                                <th className="p-2 text-left sticky left-0 bg-slate-100 z-10 border-r border-b border-slate-300 min-w-[220px]">Position / Program</th>
                                <th className="p-2 text-center border-r border-b border-slate-300">Months</th>
                                <th className="p-2 text-center border-r border-b border-slate-300">Qty</th>
                                <th className="p-2 text-center border-r border-b border-slate-300">SG</th>
                                <th className="p-2 text-right border-r border-b border-slate-300 bg-slate-200/50">Basic Salary</th>
                                
                                {compensationNames.map(name => (
                                    <th key={name} className="p-2 text-right border-r border-b border-slate-300 font-bold text-blue-800">
                                        {name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300">
                            {filteredPositions.map((pos: any) => {
                                const relatedPap = paps.find((p: any) => p.id === pos.pap_id);
                                
                                return (
                                    <tr key={pos.id} className="hover:bg-blue-50/30 transition-colors">
                                        {/* 3. Added border-r to every cell for a full grid look */}
                                        <td className="p-2 sticky left-0 bg-white border-r border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <div className="font-bold text-slate-900 leading-tight">{pos.position_title}</div>
                                            <div className="text-[9px] text-slate-500 mt-0.5 uppercase">{relatedPap?.title}</div>
                                        </td>
                                        <td className="p-2 text-center border-r border-slate-200 text-slate-600">{pos.months_employed}</td>
                                        <td className="p-2 text-center border-r border-slate-200 font-mono">{pos.num_positions}</td>
                                        <td className="p-2 text-center border-r border-slate-200 font-semibold">{pos.salary_grade}</td>
                                        <td className="p-2 text-right border-r border-slate-300 font-mono font-bold bg-slate-50/50">
                                            ₱{pos.total_salary?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>

                                        {compensationNames.map(compName => {
                                            const compMatch = pos.compensations?.find(
                                                (c: any) => c.name.trim().toLowerCase() === compName.trim().toLowerCase()
                                            );
                                            const amount = compMatch ? compMatch.amount : 0;

                                            return (
                                                <td key={compName} className={`p-2 text-right border-r border-slate-200 font-mono text-[11px] ${amount === 0 ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    {amount > 0 ? "₱" + amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <main className="m-6 max-w-none px-4 md:px-8 md:my-12 space-y-8">
            <div className="flex justify-between items-center mb-6">
                <BackButton url="/forms/staff" label="Back to List"></BackButton>
                {summary.auth_status === 'draft' && session.user.access_level === 'encode' && (
                    <div className="flex flex-row gap-2">
                        <Link 
                            href={`/forms/staff/${formData.id}/edit`}
                            className="flex items-center gap-2 bg-accent-foreground hover:bg-accent-foreground/80 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all shadow-sm"
                        >
                            <Pencil size={14} />
                            Edit Form
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
                    <Badge className="mt-2 py-1.5 px-4 rounded-full">
                        {statusLabels[summary.auth_status ?? ""] ?? summary.auth_status}
                    </Badge>
                </div>
            </div>

            <section className="space-y-10">
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-600 pl-3 py-1 bg-blue-50/50">TIER 1: ONGOING PROGRAMS</h3>
                    <div className="space-y-6">
                        {staffTypes.map(type => renderStaffTypeGroup(1, type))}
                    </div>
                </div>
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-emerald-900 border-l-4 border-emerald-600 pl-3 py-1 bg-emerald-50/50">TIER 2: NEW PROPOSALS</h3>
                    <div className="space-y-6">
                        {staffTypes.map(type => renderStaffTypeGroup(2, type))}
                    </div>
                </div>
            </section>

            <SignSection 
                formId={summary.id ?? ""} 
                tableName={'staffing_summaries'} 
                formData={summary} 
                userId={session.user.id} 
                entityId={summary.entity_id}
                authStatus={summary.auth_status ?? ""} 
                userCanSign={userCanSign && !existingSignature}
                signatoryRole={existingSignature ? existingSignature.role : (currentSignatoryRole ?? "")} 
                alreadySigned={!!existingSignature} 
                signatories={allSignatures} 
                workflow={STAFFING_WORKFLOW} 
            />

            {summary.auth_status === 'draft' && (
                <div className="pt-6 border-t mt-12 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Danger Zone</h3>
                        <p className="text-xs text-gray-500">Irreversible actions for this record.</p>
                    </div>
                    <FormDeleteButton id={summary.id} onDelete={deleteFormAction} />
                </div>
            )}
        </main>
    );
}