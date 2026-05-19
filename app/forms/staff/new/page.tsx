import StaffForm from "@/components/ui/staff/StaffingForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { createPapRepository, createSalaryRepository } from "@/src/db/factory";
import { redirect } from "next/navigation";
import { ButtonGroup } from "@/components/ui/button-group"
import BackButton from "@/components/ui/BackButton";
import { ModeToggle } from "@/components/ui/system-toggle";
import BudgetPrepClosedBanner from "@/components/ui/BudgetPrepClosedBanner";
import { getActiveBudgetPrepCycle } from "@/src/lib/budget-cycle";

export default async function NewStaffingPage() {
    const session = await sessionWithEntity();

    // 1. AUTH GUARD: If no session OR no entity_id, redirect to login
    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    if (!session || session.user.access_level !== 'encode') {
        redirect('/forms/staff?error=unauthorized');
    }

    const activeCycle = await getActiveBudgetPrepCycle()
    const components = []
    const canCreate = activeCycle?.current_phase === 'preparation'

    if (!canCreate) {
        components.push(<BudgetPrepClosedBanner key="budget-cycle-closed" />)
    }

    const PapRepository = createPapRepository('postgres');
    const paps = await PapRepository.getPapOptionsForEntityHierarchy(session.user.entity_id);

    const SalaryRepository = createSalaryRepository('postgres')
    const schedule = await SalaryRepository.getLatestSalarySchedule()

    if (!schedule) components.push(<p key="no-schedule">There is no salary schedule for this year.</p>)
    
    else if (canCreate && activeCycle) {
        const compensationRules = await SalaryRepository.getLatestCompensationRules()
        const highestSG = schedule.rates[schedule.rates.length - 1].salary_grade

        components.push(
            <div key="staff-form">
                <StaffForm
                    schedule={schedule}
                    compensationRules={compensationRules}
                    highestSG={highestSG}
                    fiscalYear={activeCycle.fiscal_year}
                    availablePaps={paps}
                    userId={session.user.id}
                    entityId={session.user.entity_id} 
                    entityName={session.user_entity.entity_name || "Unknown Agency"} 
                />
            </div>
        )
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
