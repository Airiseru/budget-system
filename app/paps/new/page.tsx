import PapForm from "@/components/ui/PapForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { redirect } from "next/navigation";

export default async function NewPapPage() {
    const session = await sessionWithEntity();

    // Guard: Ensure user is logged in and has an entity assigned
    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    return (
        <PapForm 
            entityId={session.user.entity_id} 
            entityName={session.user_entity.entity_name || "Unknown Agency"} 
        />
    );
}