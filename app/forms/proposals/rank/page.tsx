import { redirect } from "next/navigation";
import { sessionWithEntity } from "@/src/actions/auth";
import ProposalClientWrapper from "@/components/ui/proposals/ProposalNew";
import RankManager from "@/components/ui/proposals/ProposalPriority";
import { createProposalRepository } from "@/src/db/factory";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);

export default async function NewProposalPage() {
    const session = await sessionWithEntity();

    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    const data = await ProposalRepo.getAllProposalSummaries(
        session.user.id ?? "",
        session.user_entity.entity_type ?? "",
        session.user.entity_id ?? "",
    );

    if (session.user.access_level !== "encode") {
        redirect("/forms/staff?error=unauthorized");
    }
    return (
        <RankManager
            initialProposals={data}
            entityId={session.user.entity_id}
        />
    );
}
