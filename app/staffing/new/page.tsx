import StaffForm from "@/components/ui/StaffingForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { createPapRepository } from "@/src/db/factory";
import { redirect } from "next/navigation";

export default async function NewStaffingPage() {
    const session = await sessionWithEntity();

    // 1. AUTH GUARD: If no session OR no entity_id, redirect to login
    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    const papRepo = createPapRepository('postgres');
    const paps = await papRepo.getAllPaps();

    return (
        <StaffForm 
            availablePaps={paps.map(p => ({ id: p.id, title: p.title, tier: p.tier }))} 
            entityId={session.user.entity_id} 
            entityName={session.user_entity.entity_name || "Unknown Agency"} 
        />
    );
}