import { redirect } from "next/navigation";
import { sessionWithEntity } from "@/src/actions/auth";
import ProposalClientWrapper from "@/components/ui/proposals/ProposalNew";
import BudgetPrepClosedBanner from "@/components/ui/BudgetPrepClosedBanner";
import { getActiveBudgetPrepCycle } from "@/src/lib/budget-cycle";
import {
    createItemRepository,
    createPapRepository,
    createUacsRepository,
} from "@/src/db/factory";
import { EXISTING_PROJECT_PAP_STATUSES } from "@/src/lib/constants";

const ItemRepo = createItemRepository(process.env.DATABASE_TYPE || "postgres");
const PapRepo = createPapRepository(process.env.DATABASE_TYPE || "postgres");
const UacsRepo = createUacsRepository(process.env.DATABASE_TYPE || "postgres");

type NewProposalSearchParams = Promise<{
    type?: string;
}>;

export default async function NewProposalPage({
    searchParams,
}: {
    searchParams: NewProposalSearchParams;
}) {
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

    const params = await searchParams;
    const proposalType = params.type === "203" ? "203" : "202";
    const papCategory = proposalType === "203" ? "foreign" : "local";

    const [itemCatalogs, fundingSources, existingPaps] = await Promise.all([
        ItemRepo.listAllItemCatalog(),
        UacsRepo.listFundingSources(),
        PapRepo.getPapOptionsForEntityHierarchy(session.user.entity_id, {
            includeGlobal: false,
            category: papCategory,
            projectStatuses: EXISTING_PROJECT_PAP_STATUSES,
        }),
    ]);

    return (
        <ProposalClientWrapper
            userId={session.user.id}
            entityName={session.user_entity.entity_name || "Unknown Agency"}
            entityId={session.user.entity_id}
            activeFiscalYear={activeCycle.fiscal_year}
            itemCatalogs={itemCatalogs}
            fundingSources={fundingSources}
            existingPaps={existingPaps}
        />
    );
}
