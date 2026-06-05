import {
    createProposalRepository,
    createFormRepository,
    createKeyRepository,
    createAuditRepository,
} from "@/src/db/factory";
import { sessionWithEntity } from "@/src/actions/auth";
import { redirect, notFound } from "next/navigation";
import {
    getCurrentSignatoryRole,
    getNextStatus,
    canSign,
    roleInWorkflow,
} from "@/src/lib/workflows";
import { submitForm } from "@/src/actions/form";
import { PROPOSAL_WORKFLOW } from "@/src/lib/workflows/proposal-flow";
import { revalidatePath } from "next/cache";
import ProposalView from "@/components/ui/proposals/ProposalView";
import { getActiveBudgetPrepCycle, isBudgetPrepActiveForYear } from "@/src/lib/budget-cycle";
import { canViewFormIntegrity } from "@/src/lib/user-status";
import EmbeddedPreviewChromeHider from "@/components/ui/EmbeddedPreviewChromeHider";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || "postgres");
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || "postgres");
const AuditRepo = createAuditRepository(
    process.env.DATABASE_TYPE || "postgres",
);

async function canDbmActOnFormForFiscalYear(fiscalYear: number) {
    const activeCycle = await getActiveBudgetPrepCycle();
    return (
        activeCycle?.fiscal_year === fiscalYear &&
        (activeCycle.current_phase === "preparation" ||
            activeCycle.current_phase === "dbm_review")
    );
}

export default async function ProposalDetailsPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ embed?: string }>;
}) {
    const { id } = await params
    const { embed } = await searchParams
    const embeddedPreview = embed === "1"
    const session = await sessionWithEntity()
    if (!session) redirect("/login")

    const versionFamily = await FormRepo.getFormVersionFamily(id).catch(
        () => null,
    )
    if (!versionFamily) return notFound()

    const data = await ProposalRepo.getProjectProposalById(id)
    if (!data) return notFound()

    const workflow = PROPOSAL_WORKFLOW
    const currentStatus = data.auth_status ?? "draft"

    const currentSignatoryRole = getCurrentSignatoryRole(
        currentStatus,
        workflow,
    )

    const userCanSign = currentSignatoryRole
        ? canSign(
              currentStatus,
              session.user.access_level,
              session.user.workflow_role ?? "",
              currentSignatoryRole,
              workflow,
          )
        : false

    const nextStatus =
        getNextStatus(currentStatus, workflow, "submit") || "approved"

    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(
        data.id ?? "",
        session.user.id,
    )
    const allSignatures = await KeyRepo.getSignatoriesByFormId(data.id ?? "")
    const isBudgetPrepOpenForProposalYear = await isBudgetPrepActiveForYear(
        data.proposal_year,
    )
    const pastSignatures = await KeyRepo.getPastSignatoriesByFormId(
        data.id ?? "",
    )
    const latestRejection = await AuditRepo.getLatestFormRejection(
        "project_proposals",
        data.id ?? "",
    )

    const isActingAsEvaluator = session.user.workflow_role === "dbm"

    let backUrl = "/forms/proposals"

    if (session.user.role === "dbm") {
        backUrl = "/dbm/proposals"
    }

    const allowClosedCycleActions =
        session.user.role === "dbm" &&
        isActingAsEvaluator &&
        backUrl === "/dbm/proposals" &&
        await canDbmActOnFormForFiscalYear(data.proposal_year)
    const entityActionsLockedByBudgetCycle =
        !isBudgetPrepOpenForProposalYear && !allowClosedCycleActions;
    const canVerifyIntegrity = canViewFormIntegrity(session.user);

    const updateAuthStatus = async () => {
        "use server"
        if (data.auth_status !== "draft") return
        if (entityActionsLockedByBudgetCycle) return
        await FormRepo.updateFormAuthStatus(data.id ?? "", "pending_budget")
        if (data.auth_status !== "draft" && data.auth_status !== "pending_dbm")
            return

        await submitForm(
            data.id ?? "",
            data as unknown as Record<string, unknown>,
            session.user.id,
            data.entity_id,
            "project_proposals",
            nextStatus,
        )
        revalidatePath(`/forms/proposals/${id}`)
    }

    const userInWorkflow = roleInWorkflow(
        session.user.workflow_role ?? "",
        workflow,
    )

    const deleteFormAction = async (formId: string) => {
        "use server"
        if (data.auth_status !== "draft") return;
        await ProposalRepo.deleteProjectProposal(formId)
        redirect("/forms/proposals")
    }

    return (
        <>
        {embeddedPreview ? (
            <>
                <style>{`
                    [data-global-chrome],
                    nextjs-portal,
                    [data-nextjs-dev-tools-button],
                    [data-nextjs-dev-tools-indicator],
                    [data-nextjs-build-indicator],
                    [data-nextjs-toast],
                    [data-nextjs-react-dev-overlay] {
                        display: none !important;
                    }
                `}</style>
                <EmbeddedPreviewChromeHider />
            </>
        ) : null}
        <ProposalView
            data={data}
            session={session}
            backUrl={backUrl}
            versionTabs={versionFamily.forms}
            userInWorkflow={userInWorkflow}
            originalFormId={versionFamily.originalFormId}
            isDbmEvaluator={isActingAsEvaluator}
            userCanSign={entityActionsLockedByBudgetCycle ? false : userCanSign}
            budgetPrepClosedForEntityActions={entityActionsLockedByBudgetCycle}
            allowClosedCycleActions={allowClosedCycleActions}
            currentSignatoryRole={currentSignatoryRole}
            existingSignature={existingSignature}
            allSignatures={allSignatures}
            pastSignatures={pastSignatures}
            latestRejection={latestRejection}
            updateAuthStatus={updateAuthStatus}
            deleteFormAction={deleteFormAction}
            canVerifyIntegrity={canVerifyIntegrity}
            embeddedPreview={embeddedPreview}
        />
        </>
    )
}
