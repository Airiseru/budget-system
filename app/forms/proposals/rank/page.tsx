import { redirect } from "next/navigation";
import { sessionWithEntity } from "@/src/actions/auth";
import RankManager from "@/components/ui/proposals/ProposalPriority";
import { createProposalRepository } from "@/src/db/factory";
import { getActiveBudgetPrepCycle } from "@/src/lib/budget-cycle";
import { createEntityRepository } from "@/src/db/factory";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const EntityRepo = createEntityRepository(
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
        session.user_entity.entity_type ?? "",
        session.user.role ?? "",
        session.user.entity_id ?? "",
        viewingYear,
    );

    let proposals: ((typeof data)[number] & { entity_name?: string | null })[] =
        data;

    if (session.user.role === "department") {
        const uniqueEntityIds = [...new Set(data.map((p) => p.entity_id))];
        const entityNames = await Promise.all(
            uniqueEntityIds.map(async (id) => ({
                id,
                name: await EntityRepo.getFullEntityNameById(id),
            })),
        );
        const entityNameMap = new Map(entityNames.map((e) => [e.id, e.name]));
        proposals = data.map((p) => ({
            ...p,
            entity_name: entityNameMap.get(p.entity_id) ?? null,
        }));
    }

    return (
        <RankManager
            initialProposals={proposals}
            isDepartmentUser={session.user.role === "department"}
            entityId={session.user.entity_id}
            lockedYear={lockedYear}
            viewingYear={viewingYear}
            availableYears={availableYears}
        />
    );
}
