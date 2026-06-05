import BP205EntryGrid from "@/components/ui/retiree/RetireeForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { ButtonGroup } from "@/components/ui/button-group";
import BackButton from "@/components/ui/BackButton";
import {
    createFormRepository,
    createRetireeRepository,
    createSalaryRepository,
    createEntityRepository,
} from "@/src/db/factory";
import { getActiveBudgetPrepCycle, isBudgetPrepActiveForYear } from "@/src/lib/budget-cycle";
import { notFound, redirect } from "next/navigation";

const FormRepository = createFormRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const RetireeRepo = createRetireeRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const SalaryRepository = createSalaryRepository("postgres");
const EntityRepository = createEntityRepository("postgres");

async function canDbmActOnFormForFiscalYear(fiscalYear: number) {
    const activeCycle = await getActiveBudgetPrepCycle();
    return (
        activeCycle?.fiscal_year === fiscalYear &&
        (activeCycle.current_phase === "preparation" ||
            activeCycle.current_phase === "dbm_review")
    );
}

export default async function EditRetireePage({
    params,
}: {
    params: { id: string };
}) {
    const { id } = await params;
    const session = await sessionWithEntity();
    let formId = id;

    const form = await FormRepository.findFormsByParentId(id);
    if (form) {
        formId = form.id;
    }

    const retireeData = await RetireeRepo.getRetireesFormById(formId);
    if (!retireeData) notFound();

    if (!session) redirect("/login");

    const versionFamily = await FormRepository.getFormVersionFamily(formId);
    const familyHasApprovedVersion = versionFamily.forms.some(
        (form) => form.auth_status === "approved",
    );
    if (familyHasApprovedVersion) {
        redirect(`/forms/retirees/${formId}?error=locked`);
    }

    const isDbmEvaluator = session.user.workflow_role === "dbm";
    const isPendingDbm = retireeData.auth_status === "pending_dbm";
    const allowClosedCycleActions =
        session.user.role === "dbm" &&
        isDbmEvaluator &&
        isPendingDbm &&
        await canDbmActOnFormForFiscalYear(retireeData.fiscal_year);
    const isBudgetPrepOpenForYear = await isBudgetPrepActiveForYear(
        retireeData.fiscal_year,
    );

    if (!allowClosedCycleActions && !isBudgetPrepOpenForYear) {
        redirect(`/forms/retirees/${formId}?error=budget-cycle-closed`);
    }

    if (
        retireeData.auth_status !== "draft" &&
        !(isDbmEvaluator && isPendingDbm)
    ) {
        redirect(`/forms/retirees/${formId}?error=locked`);
    }

    if (
        !session ||
        (session.user.access_level !== "encode" && !isDbmEvaluator)
    ) {
        redirect("/forms/retirees?error=unauthorized");
    }

    const schedule = await SalaryRepository.getLatestSalarySchedule();

    if (!schedule) return <p>There is no salary schedule for this year.</p>;

    const highestSG = schedule.rates[schedule.rates.length - 1].salary_grade;
    const ownerEntityName = await EntityRepository.getFullEntityNameById(
        retireeData.entity_id,
    );

    return (
        <main className="m-4">
            <ButtonGroup className="my-4">
                <BackButton
                    url={`/forms/retirees/${id}`}
                    label="Back"
                ></BackButton>
            </ButtonGroup>
            <BP205EntryGrid
                schedule={schedule}
                highestSG={highestSG}
                retireeData={retireeData}
                userId={session.user.id}
                entityId={retireeData.entity_id}
                entityName={ownerEntityName || "Unknown Agency"}
                isDBM={isDbmEvaluator && isPendingDbm}
            />
        </main>
    );
}
