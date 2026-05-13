import { redirect } from "next/navigation";
import { sessionWithEntity } from "@/src/actions/auth";
import ProposalClientWrapper from "@/components/ui/proposals/ProposalNew";
import {
    createItemRepository,
    createProposalRepository,
    createUacsRepository,
} from "@/src/db/factory";
import {
    isBudgetPrepActiveForYear,
    isDbmFormActionPhaseForYear,
} from "@/src/lib/budget-cycle";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const ItemRepo = createItemRepository(process.env.DATABASE_TYPE || "postgres");
const UacsRepo = createUacsRepository(process.env.DATABASE_TYPE || "postgres");

export default async function EditProposalPage({
    params,
}: {
    params: { id: string };
}) {
    const { id } = await params;
    const session = await sessionWithEntity();

    // 1. Auth Guard
    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    // 2. Fetch the existing proposal
    const project = await ProposalRepo.getProjectProposalById(id);

    console.log(project);

    if (!project) {
        redirect("/forms/proposals?error=not-found");
    }

    // This will now pass type checking and logic
    const isDbmOverwrite =
        session.user.role === "dbm" && project.auth_status === "pending_dbm";

    if (project.auth_status !== "draft" && !isDbmOverwrite) {
        redirect(`/forms/proposals/${id}?error=locked`);
    }

    const phaseOpen = isDbmOverwrite
        ? await isDbmFormActionPhaseForYear(project.proposal_year)
        : await isBudgetPrepActiveForYear(project.proposal_year);

    if (!phaseOpen) {
        redirect(`/forms/proposals/${id}?error=budget-cycle-closed`);
    }

    if (
        !session ||
        (session.user.access_level !== "encode" && session.user.role !== "dbm")
    ) {
        redirect("/forms/proposals?error=unauthorized");
    }

    const [itemCatalogs, fundingSources] = await Promise.all([
        ItemRepo.listAllItemCatalog(),
        UacsRepo.listFundingSources(),
    ]);

    return (
        <ProposalClientWrapper
            project={project} // Pass the fetched data here
            type={project.type} // "202" or "203"
            userId={session.user.id}
            entityName={session.user_entity.entity_name || "Unknown Agency"}
            entityId={session.user.entity_id}
            itemCatalogs={itemCatalogs}
            fundingSources={fundingSources}
        />
    );
}
