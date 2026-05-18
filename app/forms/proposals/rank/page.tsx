import { redirect } from "next/navigation";
import { sessionWithEntity } from "@/src/actions/auth";
import RankManager from "@/components/ui/proposals/ProposalPriority";
import { createProposalRepository } from "@/src/db/factory";
import { getActiveBudgetPrepCycle } from "@/src/lib/budget-cycle";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);

type RankSearchParams = Promise<{
    year?: string;
}>;

export default async function NewProposalPage({
    searchParams,
}: {
    searchParams: RankSearchParams;
}) {
    const session = await sessionWithEntity();

    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    const params = await searchParams;
    const activeCycle = await getActiveBudgetPrepCycle();
    const parsedYear = params.year ? Number(params.year) : undefined;
    const selectedYear = Number.isInteger(parsedYear) ? parsedYear : undefined;
    const lockedYear = activeCycle?.fiscal_year;
    const allYearsData = lockedYear
        ? []
        : await ProposalRepo.getAllProposalSummaries(
              session.user.id ?? "",
              session.user_entity.entity_type ?? "",
              session.user.entity_id ?? "",
          );
    const availableYears = Array.from(
        new Set(allYearsData.map((proposal) => proposal.proposal_year)),
    ).sort((a, b) => b - a);
    const viewingYear = lockedYear ?? selectedYear ?? availableYears[0];

    const data = await ProposalRepo.getAllProposalSummaries(
        session.user.id ?? "",
        session.user_entity.entity_type ?? "",
        session.user.entity_id ?? "",
        viewingYear,
    );

    if (session.user.access_level !== "encode") {
        redirect("/forms/proposals?error=unauthorized");
    }
    return (
        <RankManager
            initialProposals={data}
            isDepartmentUser={session.user.role === "department"}
            entityId={session.user.entity_id}
            lockedYear={lockedYear}
            viewingYear={viewingYear}
            availableYears={availableYears}
        />
    );
}
