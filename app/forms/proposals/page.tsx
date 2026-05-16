import { createProposalRepository } from "@/src/db/factory"; // Ensure this exists
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ModeToggle } from "@/components/ui/system-toggle";
import Link from "next/link";
import { sessionWithEntity } from "@/src/actions/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import BudgetPrepClosedBanner from "@/components/ui/BudgetPrepClosedBanner";
import { getActiveBudgetPrepCycle } from "@/src/lib/budget-cycle";
import { STATUS_LABELS } from "@/src/lib/constants";

export const dynamic = "force-dynamic";

const ProposalRepo = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);

const statusColors: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
> = {
    draft: "outline",
    pending: "secondary",
    approved: "default",
    rejected: "destructive",
};

type ProposalSummary = {
    id: string;
    type: "202" | "203";
    proposal_year: number;
    priority_rank: number;
    auth_status: string | null;
    title: string;
    total_proposal_currency: string;
    total_proposal_cost: number;
    is_infrastructure: boolean;
    submission_date: Date | string | null;
};

type ProposalsSearchParams = Promise<{
    year?: string;
}>;

export default async function ProposalsPage({
    searchParams,
}: {
    searchParams: ProposalsSearchParams;
}) {
    const session = await sessionWithEntity();

    if (!session) return redirect("/login");

    try {
        const params = await searchParams;
        const activeCycle = await getActiveBudgetPrepCycle();
        const selectedYear = params.year ? Number(params.year) : undefined;
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
        const viewingYear = lockedYear ?? selectedYear;
        const canCreate =
            session?.user.access_level === "encode" &&
            activeCycle?.current_phase === "preparation";
        const shouldShowBudgetPrepBanner =
            session?.user.access_level === "encode" && !canCreate;
        // Fetching proposal summaries (assuming a similar method to staffing)
        const data = await ProposalRepo.getAllProposalSummaries(
            session.user.id ?? "",
            session.user_entity.entity_type ?? "",
            session.user.entity_id ?? "",
            viewingYear,
        );

        const renderHeader = () => (
            <div className="my-4 flex flex-wrap items-center gap-3">
                <ButtonGroup>
                    <ModeToggle />
                    <ButtonGroup>
                        <Link href="/home">
                            <Button variant="outline">Go Back</Button>
                        </Link>
                    </ButtonGroup>
                </ButtonGroup>
                {lockedYear ? (
                    <div className="rounded border px-3 py-2 text-sm text-muted-foreground">
                        Showing active FY {lockedYear}
                    </div>
                ) : (
                    <form className="flex items-center gap-2">
                        <select
                            name="year"
                            defaultValue={viewingYear ?? ""}
                            className="rounded border border-border bg-background px-3 py-2 text-sm"
                        >
                            <option value="">All years</option>
                            {availableYears.map((year) => (
                                <option key={year} value={year}>
                                    FY {year}
                                </option>
                            ))}
                        </select>
                        <Button type="submit" variant="outline">
                            Filter
                        </Button>
                    </form>
                )}
                {canCreate && (
                    <div className="flex gap-2">
                        <Link href="/forms/proposals/new?type=202">
                            <Button variant="default">
                                New BP 202 (Local)
                            </Button>
                        </Link>
                        <Link href="/forms/proposals/new?type=203">
                            <Button variant="secondary">
                                New BP 203 (Foreign)
                            </Button>
                        </Link>
                        <Link href="/forms/proposals/rank">
                            <Button variant="secondary">
                                Change Priority Ranks
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        );

        if (data.length === 0) {
            return (
                <div className="m-4">
                    {renderHeader()}
                    {shouldShowBudgetPrepBanner && <BudgetPrepClosedBanner />}
                    <h1 className="text-xl opacity-50">
                        No Project Proposals found.
                    </h1>
                </div>
            );
        }

        return (
            <div className="m-4">
                {renderHeader()}
                {shouldShowBudgetPrepBanner && <BudgetPrepClosedBanner />}

                <h1 className="text-2xl font-bold mb-6">
                    Budget Proposals (BP 202/203)
                </h1>
                <div className="grid gap-4">
                    {data.map((proposal: ProposalSummary) => (
                        <Link
                            href={`/forms/proposals/${proposal.id}`}
                            key={proposal.id}
                        >
                            <div className="border rounded-lg p-4 hover:bg-accent transition-colors">
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-3">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    proposal.type === "202"
                                                        ? "bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20"
                                                        : "bg-secondary-foreground/10 text-secondary-foreground border-secondary-foreground/20"
                                                }
                                            >
                                                BP {proposal.type}
                                            </Badge>
                                            <h2 className="font-bold text-lg">
                                                {proposal.title}
                                            </h2>
                                            <Badge
                                                variant={
                                                    statusColors[
                                                        proposal.auth_status ??
                                                            "draft"
                                                    ]
                                                }
                                            >
                                                {proposal.auth_status
                                                    ? STATUS_LABELS[
                                                          proposal.auth_status
                                                      ]
                                                    : "Draft"}
                                            </Badge>
                                        </div>
                                        <p className="text-md text-primary-500 font-bold">
                                            FY {proposal.proposal_year}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Cost:{" "}
                                            {proposal.total_proposal_currency}{" "}
                                            {Number(
                                                proposal.total_proposal_cost,
                                            ).toLocaleString()}
                                            {proposal.is_infrastructure && (
                                                <span className="ml-2 text-amber-600 dark:text-amber-400">
                                                    • Infrastructure
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-10">
                                        <div className="text-right shrink-0">
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">
                                                Submitted On
                                            </p>
                                            <span className="text-sm">
                                                {proposal.submission_date
                                                    ? new Date(
                                                          proposal.submission_date,
                                                      ).toLocaleDateString()
                                                    : "N/A"}
                                            </span>
                                        </div>
                                        <div className="font-bold flex flex-col items-center gap-1">
                                            <p className="text-secondary-foreground">
                                                Rank
                                            </p>
                                            <p className="text-secondary-foreground">
                                                #{proposal.priority_rank}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        );
    } catch (e) {
        console.error(e);
        return (
            <div className="m-4">
                <h1 className="text-red-500 font-bold">
                    Error loading Proposals
                </h1>
                <p>
                    Verify that the <code>project_proposals</code> table is
                    accessible.
                </p>
            </div>
        );
    }
}
