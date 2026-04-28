import { redirect } from "next/navigation";
import { sessionWithEntity } from "@/src/actions/auth";
import ProposalClientWrapper from "@/components/ui/proposals/ProposalNew";

export default async function NewProposalPage() {
    const session = await sessionWithEntity();

    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    if (session.user.access_level !== "encode") {
        redirect("/forms/staff?error=unauthorized");
    }
    return (
        <ProposalClientWrapper
            userId={session.user.id}
            entityName={session.user_entity.entity_name || "Unknown Agency"}
            entityId={session.user.entity_id}
        />
    );
}
