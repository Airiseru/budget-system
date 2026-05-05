import {
    createProposalRepository,
    createFormRepository,
} from "@/src/db/factory";
import { sessionWithEntity } from "@/src/actions/auth";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import ProposalView from "@/components/ui/proposals/ProposalView";
import { isBudgetPrepActiveForYear } from "@/src/lib/budget-cycle";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || "postgres");

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

    const isBudgetPrepOpenForProposalYear = await isBudgetPrepActiveForYear(
        data.proposal_year,
    );
    const entityActionsLockedByBudgetCycle = !isBudgetPrepOpenForProposalYear;

    // Server Actions
    const updateAuthStatus = async () => {
        "use server";
        if (data.auth_status !== "draft") return;
        if (entityActionsLockedByBudgetCycle) return;
        await FormRepo.updateFormAuthStatus(data.id ?? "", "pending_budget");
        revalidatePath(`/forms/proposals/${id}`);
    };

    console.log("PROPOSAL VIEW");
    console.log(data);

    return (
        <ProposalView
            data={data}
            budgetPrepClosedForEntityActions={entityActionsLockedByBudgetCycle}
            updateAuthStatus={updateAuthStatus}
        />
    );
}
