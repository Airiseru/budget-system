import StaffForm from "@/components/ui/staff/StaffingForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { createPapRepository, createSalaryRepository } from "@/src/db/factory";
import { redirect } from "next/navigation";
import { ButtonGroup } from "@/components/ui/button-group"
import BackButton from "@/components/ui/BackButton";
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

    let components = []

    const PapRepository = createPapRepository('postgres');
    const paps = await PapRepository.getAllPaps();

    const SalaryRepository = createSalaryRepository('postgres')
    const schedule = await SalaryRepository.getLatestSalarySchedule()

    if (!schedule) components.push(<p key="no-schedule">There is no salary schedule for this year.</p>)
    
    else {
        const compensationRules = await SalaryRepository.getLatestCompensationRules()
        const highestSG = schedule.rates[schedule.rates.length - 1].salary_grade

        components.push(<StaffForm
            schedule={schedule}
            compensationRules={compensationRules}
            highestSG={highestSG}
            availablePaps={paps.map(p => ({ id: p.id, title: p.title, tier: p.tier }))}
            userId={session.user.id}
            entityId={session.user.entity_id} 
            entityName={session.user_entity.entity_name || "Unknown Agency"} 
        />)
    }

    return (
        <main className="m-4">
            <ButtonGroup className='my-4'>
                <ModeToggle/>
                <ButtonGroup>
                    <BackButton url="/forms/staff" label="Back to List"></BackButton>
                </ButtonGroup>
            </ButtonGroup>
            {components}
        </main>
    );
}