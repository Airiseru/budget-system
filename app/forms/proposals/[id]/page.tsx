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
} from "@/src/lib/workflows";
import { submitForm } from "@/src/actions/form";
import { PROPOSAL_WORKFLOW } from "@/src/lib/workflows/proposal-flow";
import { revalidatePath } from "next/cache";
import ProposalView from "@/components/ui/proposals/ProposalView";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || "postgres");
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || "postgres");
const AuditRepo = createAuditRepository(
    process.env.DATABASE_TYPE || "postgres",
);

export default async function ProposalDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await sessionWithEntity();
    if (!session) redirect("/login");

    // 1. Fetch Version Family (Crucial for DBM Overwrites)
    const versionFamily = await FormRepo.getFormVersionFamily(id).catch(
        () => null,
    );
    if (!versionFamily) return notFound();

    const data = await ProposalRepo.getProjectProposalById(id);
    if (!data) return notFound();

    // 2. Workflow Logic
    const workflow = PROPOSAL_WORKFLOW;
    const currentStatus = data.auth_status ?? "draft";

    const currentSignatoryRole = getCurrentSignatoryRole(
        currentStatus,
        workflow,
    );

    const userCanSign = currentSignatoryRole
        ? canSign(
              currentStatus,
              session.user.access_level,
              session.user.workflow_role ?? "",
              currentSignatoryRole,
              workflow,
          )
        : false;

    // Determine the next status for the "Submit" action
    const nextStatus =
        getNextStatus(currentStatus, workflow, "submit") || "approved";

    // 3. Signature & Audit Data
    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(
        data.id ?? "",
        session.user.id,
    );
    const allSignatures = await KeyRepo.getSignatoriesByFormId(data.id ?? "");
    const pastSignatures = await KeyRepo.getPastSignatoriesByFormId(
        data.id ?? "",
    );
    const latestRejection = await AuditRepo.getLatestFormRejection(
        "project_proposals",
        data.id ?? "",
    );

    // 4. Back Navigation Logic
    const isOwnAgencyForm = session.user.entity_id === data.entity_id;
    const isActingAsEvaluator = session.user.workflow_role === "dbm";

    let backUrl = "/forms/proposals";

    if (session.user.role === "dbm") {
        if (!isOwnAgencyForm) {
            backUrl = "/dbm/forms";
        } else if (isActingAsEvaluator && data.auth_status === "pending_dbm") {
            backUrl = "/dbm/forms";
        }
    }

    // 5. Server Actions
    const updateAuthStatus = async () => {
        "use server";
        // Logic check: only allow submission if in draft or in DBM-edit mode
        if (data.auth_status !== "draft" && data.auth_status !== "pending_dbm")
            return;

        await submitForm(
            data.id ?? "",
            data as unknown as Record<string, unknown>,
            session.user.id,
            data.entity_id,
            "project_proposals",
            nextStatus,
        );
        revalidatePath(`/forms/proposals/${id}`);
    };

    const deleteFormAction = async (formId: string) => {
        "use server";
        if (data.auth_status !== "draft") return;
        await ProposalRepo.deleteProjectProposal(formId);
        redirect("/forms/proposals");
    };

    return (
        <ProposalView
            data={data}
            session={session}
            backUrl={backUrl}
            versionTabs={versionFamily.forms}
            originalFormId={versionFamily.originalFormId}
            isDbmEvaluator={isActingAsEvaluator}
            userCanSign={userCanSign}
            currentSignatoryRole={currentSignatoryRole}
            existingSignature={existingSignature}
            allSignatures={allSignatures}
            pastSignatures={pastSignatures}
            latestRejection={latestRejection}
            updateAuthStatus={updateAuthStatus}
            deleteFormAction={deleteFormAction}
        />
    );
}
