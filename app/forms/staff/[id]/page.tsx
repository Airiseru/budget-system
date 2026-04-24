import { STAFFING_WORKFLOW } from "@/src/lib/workflows/staffing-flow"
import { getCurrentSignatoryRole, canSign, getNextStatus } from "@/src/lib/workflows"
import { createStaffingRepository, createKeyRepository, createPapRepository, createFormRepository, createAuditRepository } from "@/src/db/factory"
import { submitForm } from "@/src/actions/form"
import { sessionWithEntity } from "@/src/actions/auth"
import { redirect, notFound } from "next/navigation"
import { revalidatePath } from "next/cache"
import StaffingView from "@/components/ui/staff/StaffingView"

const StaffingRepo = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')
const PapRepo = createPapRepository(process.env.DATABASE_TYPE || 'postgres')
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const AuditRepo = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function StaffingFormPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await sessionWithEntity()
    if (!session) redirect('/login')

    const versionFamily = await FormRepo.getFormVersionFamily(id).catch(() => null)
    if (!versionFamily) notFound()

    const summary = await StaffingRepo.getStaffingWithFormById(id)
    if (!summary) notFound()

    const paps = await PapRepo.getPapByEntityId(summary.entity_id)
    const workflow = STAFFING_WORKFLOW
    const currentSignatoryRole = getCurrentSignatoryRole(summary.auth_status ?? "", workflow)
    
    const userCanSign = currentSignatoryRole
        ? canSign(summary.auth_status ?? "", session.user.access_level, session.user.workflow_role ?? "", currentSignatoryRole, workflow)
        : false

    const nextStatus = getNextStatus(summary.auth_status ?? "", workflow, 'submit') || "approved"

    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(summary.id ?? "", session.user.id)
    const allSignatures = await KeyRepo.getSignatoriesByFormId(summary.id ?? "")
    const pastSignatures = await KeyRepo.getPastSignatoriesByFormId(summary.id ?? "")
    const latestRejection = await AuditRepo.getLatestFormRejection('staffing_summaries', summary.id ?? "")

    // Determine the correct back path based on the user's role
    const isOwnAgencyForm = session.user.entity_id === summary.entity_id;

    // Check if the user is acting as an evaluator
    const isActingAsEvaluator = session.user.workflow_role === 'dbm';

    let backUrl = '/forms/staff'

    if (session.user.role === 'dbm') {
        if (!isOwnAgencyForm) {
            backUrl = '/dbm/forms'
        } else if (isActingAsEvaluator && summary.auth_status === 'pending_dbm') {
            backUrl = '/dbm/forms'
        }
    }

    // Server Actions
    const updateAuthStatus = async () => {
        "use server"
        if (summary.auth_status !== 'draft') return
        await submitForm(summary.id ?? "", summary, session.user.id, summary.entity_id, 'staffing_summaries', nextStatus)
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
            backUrl={backUrl}
            isDbmEvaluator={isActingAsEvaluator}
            versionTabs={versionFamily.forms}
            originalFormId={versionFamily.originalFormId}
            updateAuthStatus={updateAuthStatus}
            deleteFormAction={deleteFormAction}
            workflowData={{
                userCanSign,
                currentSignatoryRole,
                existingSignature,
                allSignatures,
                pastSignatures,
                latestRejection
            }}
        />
    )
}
