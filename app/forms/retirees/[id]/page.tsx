// app/forms/retirees/[id]/page.tsx
import { createRetireeRepository, createFormRepository, createKeyRepository } from '@/src/db/factory';
import { sessionWithEntity } from '@/src/actions/auth';
import { redirect, notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { SignSection } from '@/components/ui/digital-signatures/SignSection';
import { getCurrentSignatoryRole } from '@/src/lib/workflows';
// import { ArrowLeft, Printer, FileEdit } from 'lucide-react';
import { RETIREE_WORKFLOW } from '@/src/lib/workflows/retiree-flow';
import { canSign } from '@/src/lib/workflows';
import { revalidatePath } from 'next/cache';
import BackButton from '@/components/ui/BackButton';

const RetireeRepo = createRetireeRepository(process.env.DATABASE_TYPE || 'postgres');
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')


const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
    approved: 'Approved',
};

export default async function RetireeDetailsPage({ 
    params 
}: { 
    params: Promise<{ id: string }> 
}) {
    // 1. Unwrap the promise immediately
    const { id } = await params;

    const session = await sessionWithEntity();
    if (!session) redirect('/login');

    // 2. Use the unwrapped 'id' here
    const data = await RetireeRepo.getRetireesFormById(id);

    if (!data) return notFound();

    const formData = { id: data.id, fiscal_year: data.fiscal_year, form_id: data.id }

    const workflow = RETIREE_WORKFLOW
    const currentSignatoryRole = getCurrentSignatoryRole(data.auth_status ?? "", workflow)
    const userCanSign = currentSignatoryRole
        ? canSign(data.auth_status ?? "", session.user.access_level, session.user.workflow_role ?? "", currentSignatoryRole, workflow)
        : false

    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(data.id ?? "", session.user.id)
    const allSignatures = await KeyRepo.getSignatoriesByFormId(data.id ?? "")

    const updateAuthStatus = async () => {
        "use server"
        if (data.auth_status !== 'draft') return
        await FormRepo.updateFormAuthStatus(data.id ?? "", "pending_personnel")
        revalidatePath(`/forms/staff/${id}`)
    }

    const deleteFormAction = async (formId: string) => {
        "use server"
        if (data.auth_status !== 'draft') return;
        await RetireeRepo.deleteRetireeForm(formId);
    }

    return (
        <main className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-3 items-center">
                <BackButton url="/forms/retirees" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">FY {data.fiscal_year} Retiree List Details</h1>
                    <Badge className="mt-2 py-1.5 px-4 rounded-full">
                        {statusLabels[data.auth_status ?? ""] ?? data.auth_status}
                    </Badge>
                </div>
                <div className="flex justify-end gap-2">
                    {data.auth_status === 'draft' && (
                        <form action={updateAuthStatus}><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Submit Form</button></form>
                    )}
                </div>
            </div>
            {/* Header / Breadcrumbs */}
            {/* <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                        FY {data.fiscal_year} Retiree List Details
                    </h1>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{data.id.substring(0, 8)}</Badge>
                        <Badge>{statusLabels[data.auth_status ?? 'draft']}</Badge>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" className="flex items-center gap-2">
                        <Printer size={16} /> Print BP 205
                    </Button>
                    {data.auth_status === 'draft' && (
                        <Link href={`/forms/retirees/${id}/edit`}>
                            <Button className="flex items-center gap-2 bg-blue-600">
                                <FileEdit size={16} /> Edit Form
                            </Button>
                        </Link>
                    )}
                </div>
            </div> */}

            {/* Form Metadata Section */}
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

            {/* Retirees List Table */}
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-slate-50/50">
                    <h2 className="font-bold text-slate-700 uppercase text-xs tracking-widest">
                        List of Employees for Retirement
                    </h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b text-xs uppercase">
                            <tr>
                                <th className="px-4 py-3 border-r w-12 text-center">#</th>
                                <th className="px-4 py-3 border-r">Full Name</th>
                                <th className="px-4 py-3 border-r">GSIS</th>
                                <th className="px-4 py-3 border-r text-center">Ret. Law</th>
                                <th className="px-4 py-3 border-r text-center">Position</th>
                                
                                <th className="px-4 py-3 border-r">SG</th>
                                <th className="px-4 py-3 border-r">Date of Birth</th>
                                <th className="px-4 py-3 border-r">Orig. Apptmt. Date</th>
                                <th className="px-4 py-3 border-r">Effectivity Date</th>
                                <th className="px-4 py-3 text-right">Monthly Salary</th>


                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {data.retirees.map((retiree: any, index: number) => (
                                <tr key={retiree.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-3 border-r text-center text-slate-400 font-mono text-xs">
                                        {index + 1}
                                    </td>
                                    <td className="px-4 py-3 border-r font-medium text-slate-900">
                                        {retiree.name}
                                    </td>
                                    <td className="px-4 py-3 border-r text-center">
                                        {retiree.is_gsis_member ? (
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">Yes</Badge>
                                        ) : (
                                            <Badge variant="outline">No</Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 border-r text-center">
                                        {retiree.retirement_law}
                                    </td>
                                    <td className="px-4 py-3 border-r text-center">
                                        {retiree.position}
                                    </td>
                                    <td className="px-4 py-3 border-r text-center">
                                        {retiree.salary_grade}
                                    </td>
                                    <td className="px-4 py-3 border-r text-slate-600">
                                        {new Date(retiree.date_of_birth).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 border-r text-slate-600">
                                        {new Date(retiree.original_appointment).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 border-r text-slate-600">
                                        {new Date(retiree.retirement_effectivity).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                                        ₱{Number(retiree.highest_monthly_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t">
                            <tr>
                                <td colSpan={6} className="px-4 py-3 text-right text-slate-500 uppercase text-[10px]">
                                    Total Monthly Requirement
                                </td>
                                <td className="px-4 py-3 text-right text-lg text-blue-700 font-mono">
                                    ₱{data.retirees.reduce((sum: number, r: any) => sum + Number(r.highest_monthly_salary), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Footer Summary */}
            <div className="text-[11px] text-slate-400 italic text-center">
                This document is a digital representation of BP Form 205. Generated by the Budget Management System.
            </div>

            {/* Sign section */}
                        <SignSection 
                            formId={data.id ?? ""} 
                            formData={formData} 
                            userId={session.user.id} 
                            authStatus={data.auth_status ?? ""} 
                            userCanSign={userCanSign && !existingSignature} 
                            signatoryRole={existingSignature ? existingSignature.role : (currentSignatoryRole ?? "")} 
                            alreadySigned={!!existingSignature} 
                            signatories={allSignatures} 
                        />
        </main>
    );
}