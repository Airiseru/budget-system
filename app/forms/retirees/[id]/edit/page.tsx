import BP205EntryGrid from "@/components/ui/retiree/RetireeForm";
import { sessionWithEntity } from "@/src/actions/auth";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import BackButton from "@/components/ui/BackButton";
import { ModeToggle } from "@/components/ui/system-toggle";
import {
    createRetireeRepository,
    createSalaryRepository,
} from "@/src/db/factory";
import { notFound, redirect } from "next/navigation";

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

    const retireeData = await RetireeRepo.getRetireesFormById(id);
    if (!retireeData) notFound();

    if (!session) redirect("/login");

    // This will now pass type checking and logic
    if (retireeData.auth_status !== "draft") {
        redirect(`/forms/retirees/${id}?error=locked`);
    }

    if (!session || session.user.access_level !== "encode") {
        redirect("/forms/retirees?error=unauthorized");
    }

    const schedule = await SalaryRepository.getLatestSalarySchedule();
    const highestSG = schedule.rates[schedule.rates.length - 1].salary_grade;

    return (
        <main className="m-4">
            <ButtonGroup className="my-4">
                <ModeToggle />
                <ButtonGroup>
                    <BackButton
                        url="/forms/retirees"
                        label="Back to List"
                    ></BackButton>
                </ButtonGroup>
            </ButtonGroup>
            {/* Pass the entityId here */}
            <BP205EntryGrid
                schedule={schedule}
                highestSG={highestSG}
                retireeData={retireeData}
                userId={session.user.id}
                entityId={session.user.entity_id}
                entityName={session.user_entity.entity_name || "Unknown Agency"}
            />
        </main>
    );
}
