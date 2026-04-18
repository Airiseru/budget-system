"use client";

import { Badge } from '@/components/ui/badge';
import { SignSection } from '@/components/ui/digital-signatures/SignSection';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import FormDeleteButton from '../FormDeleteButton';
import { RETIREE_WORKFLOW } from '@/src/lib/workflows/retiree-flow';

const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
    approved: 'Approved',
};

interface RetireeViewProps {
    data: any; // Use your RetireeFormInitialData interface for better type safety
    session: any;
    userCanSign: boolean;
    currentSignatoryRole: string | null;
    existingSignature: any;
    allSignatures: any[];
    updateAuthStatus: () => Promise<void>;
    deleteFormAction: (id: string) => Promise<void>;
}

export default function RetireeView({ 
    data, 
    session, 
    userCanSign, 
    currentSignatoryRole, 
    existingSignature, 
    allSignatures,
    updateAuthStatus,
    deleteFormAction,
}: RetireeViewProps) {
    const formData = { id: data.id, fiscal_year: data.fiscal_year, form_id: data.id };

    return (
        <main className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <Link 
                    href="/forms/retirees" 
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to List
                </Link>
                {data.auth_status === 'draft' && (
                <div className="flex flex-row gap-2">
                    <Link 
                        href={`/forms/retirees/${formData.id}/edit`}
                        className="flex items-center gap-2 bg-accent-foreground hover:bg-accent-foreground/80 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all shadow-sm"
                    >
                        <Pencil size={14} />
                        Edit Form
                    </Link>
                    <div className="flex justify-end gap-2">
                        <form action={updateAuthStatus}>
                            <button type="submit" className="bg-secondary-foreground text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-secondary-foreground/80">
                                Submit Form
                            </button>
                        </form>
                    </div>
                </div>
                )}
            </div>
            <div className="justify-center">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">FY {data.fiscal_year} Retiree List Details</h1>
                    <Badge className="mt-2 py-1.5 px-4 rounded-full">
                        {statusLabels[data.auth_status ?? ""] ?? data.auth_status}
                    </Badge>
                </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 border rounded-lg shadow-sm">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Fiscal Year</label>
                    <p className="text-lg font-semibold">{data.fiscal_year}</p>
                </div>
                <div className="bg-white p-4 border rounded-lg shadow-sm">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Submission Type</label>
                    <p className="text-lg font-semibold">{data.is_mandatory ? 'Mandatory' : 'Optional'}</p>
                </div>
                <div className="bg-white p-4 border rounded-lg shadow-sm">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Entity ID</label>
                    <p className="text-lg font-semibold font-mono text-sm">{data.entity_id}</p>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b text-[10px] uppercase">
                            <tr>
                                <th className="px-3 py-3 border-r w-10 text-center">#</th>
                                <th className="px-3 py-3 border-r min-w-[200px]">Personnel Details</th>
                                <th className="px-3 py-3 border-r text-center">Law / GSIS</th>
                                <th className="px-3 py-3 border-r text-center">Leave Credits (V/S)</th>
                                <th className="px-3 py-3 border-r text-center">Service / Gratuity</th>
                                <th className="px-3 py-3 border-r">Dates (DOB/Eff)</th>
                                <th className="px-3 py-3 text-right">Monthly Salary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.retirees.map((retiree: any, index: number) => (
                                <tr key={retiree.id} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-3 border-r text-center text-slate-400 font-mono text-xs">
                                        {index + 1}
                                    </td>
                                    
                                    {/* Column 1: Name & Position */}
                                    <td className="px-3 py-3 border-r">
                                        <div className="font-bold text-slate-900">{retiree.name}</div>
                                        <div className="text-[11px] text-blue-600 font-medium uppercase">
                                            SG {retiree.salary_grade} — {retiree.position}
                                        </div>
                                    </td>

                                    {/* Column 2: Law & GSIS */}
                                    <td className="px-3 py-3 border-r text-center space-y-1">
                                        <div className="text-xs font-semibold">{retiree.retirement_law}</div>
                                        <Badge variant={retiree.is_gsis_member ? "secondary" : "outline"} className="text-[9px]">
                                            {retiree.is_gsis_member ? "GSIS MEMBER" : "NON-GSIS"}
                                        </Badge>
                                    </td>

                                    {/* Column 3: Leave Credits */}
                                    <td className="px-3 py-3 border-r text-center">
                                        <div className="font-mono text-xs">
                                            <span className="text-slate-400">Vacation:</span> {retiree.number_vacation_leave ?? '0'}
                                        </div>
                                        <div className="font-mono text-xs">
                                            <span className="text-slate-400">Sick:</span> {retiree.number_sick_leave ?? '0'}
                                        </div>
                                    </td>

                                    {/* Column 4: Service & Gratuity */}
                                    <td className="px-3 py-3 border-r text-center">
                                        <div className="text-xs font-semibold">{retiree.total_credible_service ?? '0'} Yrs</div>
                                        <div className="text-[10px] text-slate-500">{retiree.number_gratuity_months ?? '0'} Mos. Gratuity</div>
                                    </td>

                                    {/* Column 5: Dates */}
                                    <td className="px-3 py-3 border-r text-xs space-y-1">
                                        <div><span className="text-slate-400">Birth:</span> {new Date(retiree.date_of_birth).toLocaleDateString()}</div>
                                        <div className="font-medium"><span className="text-slate-400">Orig. Apptmnt.:</span> {new Date(retiree.original_appointment).toLocaleDateString()}</div>
                                        <div className="font-medium"><span className="text-slate-400">Retirement:</span> {new Date(retiree.retirement_effectivity).toLocaleDateString()}</div>
                                    </td>

                                    {/* Column 6: Salary */}
                                    <td className="px-3 py-3 text-right font-mono text-slate-900 font-bold">
                                        ₱{Number(retiree.highest_monthly_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t">
                            <tr>
                                <td colSpan={8} className="px-4 py-3 text-right text-slate-500 uppercase text-[10px]">Total Monthly Requirement</td>
                                <td className="px-4 py-3 text-right text-lg text-blue-700 font-mono">
                                    ₱{data.retirees.reduce((sum: number, r: any) => sum + Number(r.highest_monthly_salary), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                userCanSign={userCanSign && !existingSignature}
                signatoryRole={existingSignature ? existingSignature.role : (currentSignatoryRole ?? "")} 
                alreadySigned={!!existingSignature} 
                signatories={allSignatures} 
                workflow={RETIREE_WORKFLOW} 
            />
            {data.auth_status === 'draft' && (
                <div className="pt-6 border-t mt-12 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Danger Zone</h3>
                        <p className="text-xs text-gray-500">Irreversible actions for this record.</p>
                    </div>
                    <FormDeleteButton id={data.id} onDelete={deleteFormAction} />
                </div>
            )}
        </main>
    );
}