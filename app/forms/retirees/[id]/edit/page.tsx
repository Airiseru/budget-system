import BP205EntryGrid from "@/components/ui/retiree/RetireeForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import BackButton from "@/components/ui/BackButton";
import { ModeToggle } from "@/components/ui/system-toggle";
import {
    createFormRepository,
    createRetireeRepository,
    createSalaryRepository,
} from "@/src/db/factory";
import { notFound, redirect } from "next/navigation";

const FormRepository = createFormRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const RetireeRepo = createRetireeRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const SalaryRepository = createSalaryRepository("postgres");

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

    // This will now pass type checking and logic
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

    return (
        <main className="m-4">
            <ButtonGroup className="my-4">
                <ModeToggle />
                <ButtonGroup>
                    <BackButton
                        url={`/forms/retirees/${id}`}
                        label="Back"
                    ></BackButton>
                </ButtonGroup>
            </ButtonGroup>
            <BP205EntryGrid
                schedule={schedule}
                highestSG={highestSG}
                retireeData={retireeData}
                userId={session.user.id}
                entityId={session.user.entity_id}
                entityName={session.user_entity.entity_name || "Unknown Agency"}
                isDBM={isDbmEvaluator && isPendingDbm}
            />
        </main>
    );
}
