import {
    createProposalRepository,
    createFormRepository,
    createKeyRepository,
} from "@/src/db/factory";
import { sessionWithEntity } from "@/src/actions/auth";
import { redirect, notFound } from "next/navigation";
import { getCurrentSignatoryRole } from "@/src/lib/workflows";
import { PROPOSAL_WORKFLOW } from "@/src/lib/workflows/proposal-flow";
import { canSign } from "@/src/lib/workflows";
import { revalidatePath } from "next/cache";
import ProposalView from "@/components/ui/proposals/ProposalView";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || "postgres");
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || "postgres");

const statusLabels: Record<string, string> = {
    draft: "Draft",
    pending_budget: "Pending Budget Officer",
    pending_planning: "Pending Planning Officer",
    pending_chief_accountant: "Pending Chief Accountant",
    pending_agency_head: "Pending Agency Head",
    approved: "Approved",
};

export default async function RetireeDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await sessionWithEntity();
    if (!session) redirect("/login");

    const data = await ProposalRepo.getProjectProposalById(id);
    if (!data) return notFound();

    // Logic for workflow
    const workflow = PROPOSAL_WORKFLOW;
    const currentSignatoryRole = getCurrentSignatoryRole(
        data.auth_status ?? "",
        workflow,
    );
    const userCanSign = currentSignatoryRole
        ? canSign(
              data.auth_status ?? "",
              session.user.access_level,
              session.user.workflow_role ?? "",
              currentSignatoryRole,
              workflow,
          )
        : false;

    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(
        data.id ?? "",
        session.user.id,
    );
    const allSignatures = await KeyRepo.getSignatoriesByFormId(data.id ?? "");

    // Server Actions
    const updateAuthStatus = async () => {
        "use server";
        if (data.auth_status !== "draft") return;
        await FormRepo.updateFormAuthStatus(data.id ?? "", "pending_budget");
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
            userCanSign={userCanSign}
            currentSignatoryRole={currentSignatoryRole}
            existingSignature={existingSignature}
            allSignatures={allSignatures}
            updateAuthStatus={updateAuthStatus}
            deleteFormAction={deleteFormAction}
        />
    );
}
