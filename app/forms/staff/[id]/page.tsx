// forms/staff/[id]/page.tsx

import { STAFFING_WORKFLOW } from "@/src/lib/workflows/staffing-flow"
import { getCurrentSignatoryRole, canSign } from "@/src/lib/workflows"
import { createStaffingRepository, createKeyRepository, createFormRepository, createPapRepository } from "@/src/db/factory"
import { sessionWithEntity } from "@/src/actions/auth"
import { redirect, notFound } from "next/navigation"
import { SignSection } from "@/components/ui/digital-signatures/SignSection"
import BackButton from "@/components/ui/BackButton"
import { Badge } from "@/components/ui/badge"
import { revalidatePath } from "next/cache"
import FormDeleteButton from "@/components/ui/FormDeleteButton"
import React from "react"

export const dynamic = "force-dynamic"

const FormRepo = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const StaffingRepo = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')
const PapRepo = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
    pending_agency_head: 'Pending Agency Head',
    approved: 'Approved',
}

interface Compensation {
    id: string;
    name: string;
    amount: number;
}

interface StaffingPosition {
    id: string;
    pap_id: string;
    position_title: string;
    organizational_unit: string;
    staff_type: string;
    months_employed: number;
    num_positions: number;
    salary_grade: number;
    total_salary: number;
    compensations: Compensation[];
}

const staffTypes = ["Casual", "Contractual", "Part-Time", "Substitute"];

export default async function StaffingFormPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await sessionWithEntity()
    if (!session) redirect('/login')

    // Update the summary fetch to cast the type
    const summary = await StaffingRepo.getStaffingWithFormById(id) as (any & { positions: StaffingPosition[] })
    console.log(summary)
    if (!summary) notFound()

    const entityId = session.user.entity_id;
    
    // Fetch PAPs to determine Tiers for the read-only view
    const paps = await PapRepo.getPapByEntityId(entityId)

    const workflow = STAFFING_WORKFLOW
    const currentSignatoryRole = getCurrentSignatoryRole(summary.auth_status ?? "", workflow)
    const userCanSign = currentSignatoryRole
        ? canSign(summary.auth_status ?? "", session.user.access_level, session.user.workflow_role ?? "", currentSignatoryRole, workflow)
        : false

    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(summary.id ?? "", session.user.id)
    const allSignatures = await KeyRepo.getSignatoriesByFormId(summary.id ?? "")

    const formData = { id: summary.id, fiscal_year: summary.fiscal_year, form_id: summary.id }

    const updateAuthStatus = async () => {
        "use server"
        if (summary.auth_status !== 'draft') return
        await FormRepo.updateFormAuthStatus(summary.id ?? "", "pending_personnel")
        revalidatePath(`/forms/staff/${id}`)
    }

    const deleteFormAction = async (formId: string) => {
        "use server"
        if (summary.auth_status !== 'draft') return;
        await StaffingRepo.deleteStaffingForm(formId);
    }
    
    // --- RENDER HELPERS ---
    const renderStaffTypeGroup = (tier: number, type: string) => {
        const filteredPositions = (summary?.positions || []).filter((pos: any) => {
            const pap = paps.find((p: any) => p.id === pos.pap_id);
            return pap?.tier === tier && pos.staff_type === type;
        });

        if (filteredPositions.length === 0) return null;

        return (
            <div key={type} className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-slate-100 px-2 py-1 rounded w-fit">
                    {type} Positions
                </h4>
                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-50 border-b text-[11px] font-semibold text-slate-600">
                            <tr>
                                <th className="p-3 text-left w-1/3">Position / Program</th>
                                <th className="p-3 text-center">Months</th>
                                <th className="p-3 text-center">Qty</th>
                                <th className="p-3 text-center">SG</th>
                                <th className="p-3 text-right">Basic Salary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredPositions.map((pos: any) => {
                                // Find the PAP for this specific position
                                const relatedPap = paps.find((p: any) => p.id === pos.pap_id);
                                
                                return (
                                    <React.Fragment key={pos.id}>
                                        <tr className="bg-white">
                                            <td className="p-3">
                                                <div className="font-bold text-slate-900">{pos.position_title}</div>
                                                {/* Display PAP Details */}
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4 border-blue-200 text-blue-700 bg-blue-50/30">
                                                        {relatedPap?.project_type || 'No Code'}
                                                    </Badge>
                                                    <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                                        {relatedPap?.title || 'Unknown Program'}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 italic mt-0.5 ml-1">
                                                    {pos.organizational_unit}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center text-slate-600">{pos.months_employed}</td>
                                            <td className="p-3 text-center font-mono font-medium">{pos.num_positions}</td>
                                            <td className="p-3 text-center font-semibold text-slate-700">{pos.salary_grade}</td>
                                            <td className="p-3 text-right font-mono text-slate-900">
                                                ₱{pos.total_salary?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        {/* Related Compensations Row */}
                                        {pos.compensations && pos.compensations.length > 0 && (
                                            <tr className="bg-slate-50/30 border-t-0">
                                                <td colSpan={5} className="p-3 pt-0 pb-4">
                                                    <div className="ml-4 flex flex-wrap gap-1.5">
                                                        {pos.compensations.map((comp: Compensation) => (
                                                            <div key={comp.id} className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] shadow-xs text-slate-600">
                                                                <span className="font-semibold text-slate-500 uppercase">{comp.name}</span>
                                                                <span className="text-slate-300">|</span>
                                                                <span className="font-mono text-blue-600">₱{comp.amount.toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <main className="m-6 max-w-5xl md:mx-auto md:my-12 space-y-8">
            {/* Header Section (Keep your existing grid) */}
            <div className="grid grid-cols-3 items-center">
                <BackButton url="/forms/staff" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">FY {summary.fiscal_year} Staffing Plan</h1>
                    <Badge className="mt-2 py-1.5 px-4 rounded-full">
                        {statusLabels[summary.auth_status ?? ""] ?? summary.auth_status}
                    </Badge>
                </div>
                <div className="flex justify-end gap-2">
                    {summary.auth_status === 'draft' && (
                        <form action={updateAuthStatus}><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Submit Form</button></form>
                    )}
                </div>
            </div>

            {/* Position Summary Table View */}
            <section className="space-y-10">
                {/* Tier 1 Group */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-blue-900 border-l-4 border-blue-600 pl-3 py-1 bg-blue-50/50">
                        TIER 1: ONGOING PROGRAMS
                    </h3>
                    <div className="space-y-6">
                        {staffTypes.map(type => renderStaffTypeGroup(1, type))}
                    </div>
                </div>

                {/* Tier 2 Group */}
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-emerald-900 border-l-4 border-emerald-600 pl-3 py-1 bg-emerald-50/50">
                        TIER 2: NEW PROPOSALS
                    </h3>
                    <div className="space-y-6">
                        {staffTypes.map(type => renderStaffTypeGroup(2, type))}
                    </div>
                </div>
            </section>

            {/* Sign section */}
            <SignSection 
                formId={summary.id ?? ""} 
                formData={formData} 
                userId={session.user.id} 
                authStatus={summary.auth_status ?? ""} 
                userCanSign={userCanSign && !existingSignature} 
                signatoryRole={existingSignature ? existingSignature.role : (currentSignatoryRole ?? "")} 
                alreadySigned={!!existingSignature} 
                signatories={allSignatures} 
            />

            {/* Danger Zone (Keep existing) */}
            {summary.auth_status === 'draft' && (
                <div className="pt-6 border-t mt-12 flex justify-between items-center">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Danger Zone</h3>
                        <p className="text-xs text-gray-500">Irreversible actions for this record.</p>
                    </div>
                    <FormDeleteButton id={id} onDelete={deleteFormAction} />
                </div>
            )}
        </main>
    )
}