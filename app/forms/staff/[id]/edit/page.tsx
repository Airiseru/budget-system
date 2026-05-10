import StaffForm from "@/components/ui/staff/StaffingForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { createFormRepository, createStaffingRepository, createPapRepository, createSalaryRepository, createEntityRepository } from "@/src/db/factory"
import { ButtonGroup } from "@/components/ui/button-group"
import BackButton from "@/components/ui/BackButton";
import { ModeToggle } from "@/components/ui/system-toggle";
import { notFound, redirect } from 'next/navigation'
import { getActiveBudgetPrepCycle, isBudgetPrepActiveForYear } from "@/src/lib/budget-cycle";

const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const StaffingRepository = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')
const SalaryRepository = createSalaryRepository(process.env.DATABASE_TYPE || 'postgres')
const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

async function canDbmActOnFormForFiscalYear(fiscalYear: number) {
    const activeCycle = await getActiveBudgetPrepCycle()
    return (
        activeCycle?.fiscal_year === fiscalYear &&
        (activeCycle.current_phase === 'preparation' ||
            activeCycle.current_phase === 'dbm_review')
    )
}

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
    // 1. Resolve params
    const { id } = await params
    let formId = id
    
    // 2. Auth Check
    const session = await sessionWithEntity();
    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    // 3. Fetch Staff Record
    const form = await FormRepository.findFormsByParentId(id)

    if (form) {
        formId = form.id
    }

    const familyHasApprovedVersion = await FormRepository.hasApprovedFormInFamily(formId)

    const staff = await StaffingRepository.getStaffingById(formId);
    if (!staff) notFound()

    if (familyHasApprovedVersion) {
        redirect(`/forms/staff/${formId}?error=locked`)
    }

    const isDbmEvaluator = session.user.workflow_role === 'dbm'
    const isPendingDbm = staff.auth_status === 'pending_dbm'
    const allowClosedCycleActions =
        session.user.role === 'dbm' &&
        isDbmEvaluator &&
        isPendingDbm &&
        await canDbmActOnFormForFiscalYear(staff.fiscal_year)
    const isBudgetPrepOpenForYear = await isBudgetPrepActiveForYear(staff.fiscal_year)

    if (!allowClosedCycleActions && !isBudgetPrepOpenForYear) {
        redirect(`/forms/staff/${formId}?error=budget-cycle-closed`)
    }

    // This will now pass type checking and logic
    if (staff.auth_status !== 'draft' && !(isDbmEvaluator && isPendingDbm)) {
        redirect(`/forms/staff/${formId}?error=locked`);
    }

    // 5. Authorization Check (Role based)
    if (session.user.access_level !== 'encode' && !isDbmEvaluator) {
        redirect('/forms/staff?error=unauthorized');
    }

    const papRepo = createPapRepository('postgres');
    const paps = await papRepo.getAllPaps();

    const schedule = await SalaryRepository.getLatestSalarySchedule()

    if (!schedule) return (
        <main className="m-4">
            <p>There is no salary schedule for this year.</p>
        </main>
    )

    const compensationRules = await SalaryRepository.getLatestCompensationRules()
    const highestSG = schedule.rates[schedule.rates.length - 1].salary_grade
    const ownerEntityName = await EntityRepository.getFullEntityNameById(staff.entity_id)

    return (
        <main className="m-4">
            <ButtonGroup className='my-4'>
                <ModeToggle/>
                <ButtonGroup>
                    <BackButton url={`/forms/staff/${id}`} label="Back"></BackButton>
                </ButtonGroup>
            </ButtonGroup>
            <StaffForm
                isDBM={isDbmEvaluator && isPendingDbm}
                schedule={schedule}
                compensationRules={compensationRules}
                highestSG={highestSG}
                fiscalYear = {staff.fiscal_year}
                staff={staff}
                availablePaps={paps.map(p => ({ id: p.id, title: p.title }))} 
                userId={session.user.id}
                entityId={staff.entity_id} 
                entityName={ownerEntityName || "Unknown Agency"} 
            />
        </main>
    );
}
