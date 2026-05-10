import BP205EntryGrid from "@/components/ui/retiree/RetireeForm"
import BackButton from "@/components/ui/BackButton"
import { sessionWithEntity } from "@/src/actions/auth"
import { createSalaryRepository } from "@/src/db/factory"
import { redirect } from "next/navigation"
import { ButtonGroup } from "@/components/ui/button-group"
import { ModeToggle } from "@/components/ui/system-toggle"
import BudgetPrepClosedBanner from "@/components/ui/BudgetPrepClosedBanner"
import { getActiveBudgetPrepCycle } from "@/src/lib/budget-cycle"

export default async function NewRetireeFormPage() {
    const session = await sessionWithEntity();
    if (!session) redirect('/login');

    if (!session || session.user.access_level !== 'encode') {
        redirect('/forms/retirees?error=unauthorized');
    }

    const activeCycle = await getActiveBudgetPrepCycle()
    const components = []
    const canCreate = activeCycle?.current_phase === 'preparation'

    if (!canCreate) {
        components.push(<BudgetPrepClosedBanner key="budget-cycle-closed" />)
    }

    const SalaryRepository = createSalaryRepository('postgres')
    const schedule = await SalaryRepository.getLatestSalarySchedule()

    if (!schedule) components.push(<p key="no-schedule">There is no salary schedule for this year.</p>)

    else if (canCreate && activeCycle) {
        const highestSG = schedule.rates[schedule.rates.length - 1].salary_grade
        components.push(
            <div key="retiree-form">
                <BP205EntryGrid
                    schedule={schedule}
                    highestSG={highestSG}
                    initialFiscalYear={activeCycle.fiscal_year}
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
                    <BackButton url="/forms/retirees" label="Back to List"></BackButton>
                </ButtonGroup>
            </ButtonGroup>
            {components}
        </main>
    );
}
        
        
