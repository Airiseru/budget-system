import {
    createRetireeRepository,
    createKeyRepository,
    createFormRepository,
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
import { RETIREE_WORKFLOW } from "@/src/lib/workflows/retiree-flow";
import { revalidatePath } from "next/cache";
import RetireeView from "@/components/ui/retiree/RetireeView";

const RetireeRepo = createRetireeRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || "postgres");
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || "postgres");
const AuditRepo = createAuditRepository(
    process.env.DATABASE_TYPE || "postgres",
);

export default async function RetireeDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await sessionWithEntity();
    if (!session) redirect("/login");

    const versionFamily = await FormRepo.getFormVersionFamily(id).catch(
        () => null,
    );
    if (!versionFamily) return notFound();

    const data = await RetireeRepo.getRetireesFormById(id);
    if (!data) return notFound();

    // Workflow Logic
    const workflow = RETIREE_WORKFLOW;
    const currentStatus = data.auth_status ?? "draft";

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

    const userInWorkflow = roleInWorkflow(session.user.workflow_role ?? "", workflow)

    const nextStatus =
        getNextStatus(currentStatus, workflow, "submit") || "approved";

    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(
        data.id ?? "",
        session.user.id,
    );
    const allSignatures = await KeyRepo.getSignatoriesByFormId(data.id ?? "");
    const pastSignatures = await KeyRepo.getPastSignatoriesByFormId(
        data.id ?? "",
    );
    const latestRejection = await AuditRepo.getLatestFormRejection(
        "retirees_list",
        data.id ?? "",
    );

    // Determine the correct back path based on the user's role
    const isOwnAgencyForm = session.user.entity_id === data.entity_id;

    // Check if the user is acting as an evaluator
    const isActingAsEvaluator = session.user.workflow_role === "dbm";

    let backUrl = "/forms/retirees";

    if (session.user.role === "dbm") {
        if (!isOwnAgencyForm) {
            backUrl = "/dbm/forms";
        } else if (isActingAsEvaluator && data.auth_status === "pending_dbm") {
            backUrl = "/dbm/forms";
        }
    }

    // Server Actions
    const updateAuthStatus = async () => {
        "use server";
        if (data.auth_status !== "draft") return;
        await submitForm(
            data.id ?? "",
            data,
            session.user.id,
            data.entity_id,
            "retirees_list",
            nextStatus,
        );
        revalidatePath(`/forms/retirees/${id}`);
    };

    const deleteFormAction = async (formId: string) => {
        "use server";
        if (data.auth_status !== "draft") return;
        await RetireeRepo.deleteRetireeForm(formId);
        redirect("/forms/retirees");
    };

    return (
        <RetireeView
            data={data}
            session={session}
            backUrl={backUrl}
            versionTabs={versionFamily.forms}
            originalFormId={versionFamily.originalFormId}
            isDbmEvaluator={isActingAsEvaluator}
            userInWorkflow={userInWorkflow}
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
