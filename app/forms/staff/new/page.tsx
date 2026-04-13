import StaffForm from "@/components/ui/staff/StaffingForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { createPapRepository } from "@/src/db/factory";
import { redirect } from "next/navigation";
import { Button } from '@/components/ui/button'
import { ButtonGroup } from "@/components/ui/button-group"
import Link from "next/link";
import { ModeToggle } from "@/components/ui/system-toggle";

export default async function NewStaffingPage() {
    const session = await sessionWithEntity();

    // 1. AUTH GUARD: If no session OR no entity_id, redirect to login
    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    if (!session || session.user.access_level !== 'encode') {
        redirect('/forms/staff?error=unauthorized');
    }

    const papRepo = createPapRepository('postgres');
    const paps = await papRepo.getAllPaps();

    return (
        <main className="m-4">
            <ButtonGroup className='my-4'>
                <ModeToggle/>
                <ButtonGroup>
                    <Link href="/home">
                        <Button variant="outline" aria-label="Go Back">Go Back</Button>
                    </Link>
                </ButtonGroup>
            </ButtonGroup>
            <StaffForm 
                availablePaps={paps.map(p => ({ id: p.id, title: p.title, tier: p.tier }))} 
                entityId={session.user.entity_id} 
                entityName={session.user_entity.entity_name || "Unknown Agency"} 
            />
        </main>
    );
}