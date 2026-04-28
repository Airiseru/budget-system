import { redirect } from "next/navigation";
import { sessionWithEntity } from "@/src/actions/auth";
import ProposalClientWrapper from "@/components/ui/proposals/ProposalNew";
import { createProposalRepository } from "@/src/db/factory";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);

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
    if (project.auth_status !== "draft") {
        redirect(`/forms/retirees/${id}?error=locked`);
    }

    if (!session || session.user.access_level !== "encode") {
        redirect("/forms/retirees?error=unauthorized");
    }

    return (
        <ProposalClientWrapper
            project={project} // Pass the fetched data here
            type={project.type} // "202" or "203"
            userId={session.user.id}
            entityName={session.user_entity.entity_name || "Unknown Agency"}
            entityId={session.user.entity_id}
        />
    );
}
