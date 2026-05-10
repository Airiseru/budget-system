import { redirect } from "next/navigation";
import { sessionWithEntity } from "@/src/actions/auth";
import ProposalClientWrapper from "@/components/ui/proposals/ProposalNew";
import BudgetPrepClosedBanner from "@/components/ui/BudgetPrepClosedBanner";
import { getActiveBudgetPrepCycle } from "@/src/lib/budget-cycle";

export default async function NewProposalPage() {
    const session = await sessionWithEntity();

    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    if (session.user.access_level !== "encode") {
        redirect("/forms/proposals?error=unauthorized");
    }

    const activeCycle = await getActiveBudgetPrepCycle();
    const canCreate = activeCycle?.current_phase === "preparation";

    if (!canCreate || !activeCycle) {
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-8">
                <BudgetPrepClosedBanner />
            </div>
        );
    }

    return (
        <ProposalClientWrapper
            userId={session.user.id}
            entityName={session.user_entity.entity_name || "Unknown Agency"}
            entityId={session.user.entity_id}
            activeFiscalYear={activeCycle.fiscal_year}
        />
    );
}
