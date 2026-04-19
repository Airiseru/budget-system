import StaffForm from "@/components/ui/staff/StaffingForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { createStaffingRepository, createPapRepository } from "@/src/db/factory"
import { ButtonGroup } from "@/components/ui/button-group"
import BackButton from "@/components/ui/BackButton";
import { ModeToggle } from "@/components/ui/system-toggle";
import { notFound, redirect } from 'next/navigation'

const StaffingRepo = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
    // 1. Resolve params
    const { id } = await params
    
    // 2. Auth Check
    const session = await sessionWithEntity();
    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    // 3. Fetch Staff Record
    const staff = await StaffingRepo.getStaffingById(id);
    if (!staff) notFound();

    // This will now pass type checking and logic
    if (staff.auth_status !== 'draft') {
        redirect(`/forms/staff/${id}?error=locked`);
    }

    // 5. Authorization Check (Role based)
    if (session.user.access_level !== 'encode') {
        redirect('/forms/staff?error=unauthorized');
    }

    const papRepo = createPapRepository('postgres');
    const paps = await papRepo.getAllPaps();

    return (
        <main className="m-4">
            <ButtonGroup className='my-4'>
                <ModeToggle/>
                <ButtonGroup>
                    <BackButton url="/forms/staff" label="Back to List"></BackButton>
                </ButtonGroup>
            </ButtonGroup>
            <StaffForm 
                staff={staff}
                availablePaps={paps.map(p => ({ id: p.id, title: p.title, tier: p.tier }))} 
                userId={session.user.id}
                entityId={session.user.entity_id} 
                entityName={session.user_entity.entity_name || "Unknown Agency"} 
            />
        </main>
    );
}