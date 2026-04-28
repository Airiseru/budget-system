import { STAFFING_WORKFLOW } from "@/src/lib/workflows/staffing-flow"
import { getCurrentSignatoryRole, canSign, getNextStatus } from "@/src/lib/workflows"
import { createStaffingRepository, createKeyRepository, createPapRepository } from "@/src/db/factory"
import { submitForm } from "@/src/actions/form"
import { sessionWithEntity } from "@/src/actions/auth"
import { redirect, notFound } from "next/navigation"
import { revalidatePath } from "next/cache"
import StaffingView from "@/components/ui/staff/StaffingView"

const StaffingRepo = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')
const PapRepo = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function StaffingFormPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await sessionWithEntity()
    if (!session) redirect('/login')

    const summary = await StaffingRepo.getStaffingWithFormById(id)
    if (!summary) notFound()

    const paps = await PapRepo.getPapByEntityId(session.user.entity_id)
    const workflow = STAFFING_WORKFLOW
    const currentSignatoryRole = getCurrentSignatoryRole(summary.auth_status ?? "", workflow)
    
    const userCanSign = currentSignatoryRole
        ? canSign(summary.auth_status ?? "", session.user.access_level, session.user.workflow_role ?? "", currentSignatoryRole, workflow)
        : false

    const nextSignatoryRole = getNextStatus(summary.auth_status ?? "", workflow) || "approved"

    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(summary.id ?? "", session.user.id)
    const allSignatures = await KeyRepo.getSignatoriesByFormId(summary.id ?? "")

    // Server Actions
    const updateAuthStatus = async () => {
        "use server"
        if (summary.auth_status !== 'draft') return
        await submitForm(summary.id ?? "", summary, session.user.id, summary.entity_id, 'staffing_summaries', nextSignatoryRole)
        revalidatePath(`/forms/staff/${id}`)
    }

    const deleteFormAction = async (formId: string) => {
        "use server"
        if (summary.auth_status !== 'draft') return;
        await StaffingRepo.deleteStaffingForm(formId);
        redirect('/forms/staff')
    }

    return (
        <StaffingView 
            summary={summary}
            paps={paps}
            session={session}
            updateAuthStatus={updateAuthStatus}
            deleteFormAction={deleteFormAction}
            workflowData={{
                userCanSign,
                currentSignatoryRole,
                existingSignature,
                allSignatures
            }}
        />
    )
}