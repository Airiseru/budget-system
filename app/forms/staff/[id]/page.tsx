import { STAFFING_WORKFLOW } from "@/src/lib/workflows/staffing-flow"
import { getCurrentSignatoryRole, canSign } from "@/src/lib/workflows"
import { createStaffingRepository, createKeyRepository, createFormRepository } from "@/src/db/factory"
import { sessionWithEntity } from "@/src/actions/auth"
import { redirect, notFound } from "next/navigation"
import { SignSection } from "@/components/ui/digital-signatures/SignSection"
import BackButton from "@/components/ui/BackButton"
import { Badge } from "@/components/ui/badge"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

const FormRepo = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const StaffingRepo = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')

const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
    pending_agency_head: 'Pending Agency Head',
    approved: 'Approved',
}

export default async function StaffingFormPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const session = await sessionWithEntity()
    if (!session) redirect('/login')

    const summary = await StaffingRepo.getStaffingWithFormById(id)
    if (!summary) notFound()

    const workflow = STAFFING_WORKFLOW
    const currentSignatoryRole = getCurrentSignatoryRole(summary.auth_status ?? "", workflow)
    const userCanSign = currentSignatoryRole
        ? canSign(summary.auth_status ?? "", session.user.access_level, session.user.workflow_role ?? "", currentSignatoryRole, workflow)
        : false

    // check if user already signed this form
    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(
        summary.form_id ?? "",
        session.user.id
    )

    // fetch all existing signatures
    const allSignatures = await KeyRepo.getSignatoriesByFormId(summary.form_id ?? "")

    const formData = {
        id: summary.id,
        fiscal_year: summary.fiscal_year,
        form_id: summary.form_id,
    }

    // handle auth update
    const updateAuthStatus = async () => {
        "use server"

        // check if the user is authorized to update the auth status
        // TO DO

        // check if auth is draft
        if (summary.auth_status !== 'draft') return

        // update auth status
        await FormRepo.updateFormAuthStatus(summary.form_id ?? "", "pending_personnel")
        revalidatePath(`/forms/staff/${id}`)
    }

    return (
        <main className="m-6 max-w-4xl md:mx-auto md:my-12 space-y-6">
            <div className="grid grid-cols-3 items-center">
                <div>
                    <BackButton url="/forms/staff" />
                </div>

                <div className="text-center justify-self-center w-full">
                    <h1 className="text-3xl font-bold tracking-tight whitespace-nowrap">
                        FY {summary.fiscal_year} Staffing Plan
                    </h1>
                    <div className="flex justify-center mt-2">
                        <Badge
                            className={
                                summary.auth_status === 'approved' 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-full' 
                                : 'py-3 px-4 rounded-full'
                            }
                        >
                            {statusLabels[summary.auth_status ?? ""] ?? summary.auth_status}
                        </Badge>
                    </div>
                </div>
                
                <div className="flex justify-end">
                    {summary.auth_status === 'draft' && (
                        <form action={updateAuthStatus}>
                            <button
                                type="submit"
                                className="bg-accent-foreground text-white px-4 py-2 rounded hover:bg-accent-foreground/80 transition-all"
                            >
                                Submit Form
                            </button>
                        </form>
                    )}
                </div>
            </div>

            {/* form details */}
            <div className="border border-border rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Fiscal Year</p>
                        <p className="font-medium">{summary.fiscal_year}</p>
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Submission Date</p>
                        <p className="font-medium">
                            {new Date(summary.submission_date ?? '').toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* sign section */}
            <SignSection
                formId={summary.form_id ?? ""}
                formData={formData}
                userId={session.user.id}
                authStatus={summary.auth_status ?? ""}
                userCanSign={userCanSign && !existingSignature}
                signatoryRole={existingSignature ? existingSignature.role : (currentSignatoryRole ?? "")}
                alreadySigned={!!existingSignature}
                signatories={allSignatures}
            />
        </main>
    )
}