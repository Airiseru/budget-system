"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";

// You can put this at the top of your file
interface ProposalSummary {
    id: string;
    entity_id: string;
    codename: string;
    proposal_year: number;
    priority_rank: number;
    type: "202" | "203";
    total_proposal_cost: string | number;
    total_proposal_currency: string;
    auth_status: string | null;
    submission_date?: Date;
    is_infrastructure: boolean;
    title: string;
}

interface ProposalPriorityProps {
    initialProposals: ProposalSummary[];
    entityId: string;
    lockedYear?: number;
    viewingYear?: number;
    availableYears?: number[];
}

export default function RankManager({
    initialProposals,
    entityId,
    lockedYear,
    viewingYear,
    availableYears = [],
}: ProposalPriorityProps) {
    const [proposals, setProposals] = useState<ProposalSummary[]>(
        initialProposals || [],
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [targetRank, setTargetRank] = useState("");

    useEffect(() => {
        setProposals(initialProposals || []);
        setSelectedIds([]);
        setTargetRank("");
        setError(null);
    }, [initialProposals, viewingYear]);

    const selectedProposals = selectedIds
        .map((id) => proposals.find((proposal) => proposal.id === id))
        .filter((proposal): proposal is ProposalSummary => Boolean(proposal));

    const toggleSelection = (proposal: ProposalSummary) => {
        if (proposal.auth_status !== "draft" || loading) return;

        setError(null);
        setSelectedIds((current) => {
            if (current.includes(proposal.id)) {
                return current.filter((id) => id !== proposal.id);
            }

            return [...current.slice(-1), proposal.id];
        });
    };

    const refreshProposals = async () => {
        const params = new URLSearchParams({ entityId });

        if (viewingYear) {
            params.set("year", String(viewingYear));
        }

        const response = await fetch(`/api/proposals?${params.toString()}`);
        const updatedData = await response.json();
        setProposals(updatedData);
    };

    const handleSwapSelected = async () => {
        if (selectedProposals.length !== 2) {
            setError("Select two draft proposals to swap their priority ranks.");
            return;
        }

        setLoading(true);
        setError(null);
        const [propA, propB] = selectedProposals;

        if (propA.auth_status !== "draft" || propB.auth_status !== "draft") {
            setError("Priority ranks can only be changed while both proposals are drafts.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/proposals/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entityId,
                    proposalIdA: propA.id,
                    rankA: propA.priority_rank,
                    proposalIdB: propB.id,
                    rankB: propB.priority_rank,
                    proposalYear: propA.proposal_year,
                }),
            });

            if (res.ok) {
                await refreshProposals();
                setSelectedIds([]);
            } else {
                const payload = await res.json();
                setError(payload.error || "Failed to swap ranks.");
            }
        } catch (err) {
            console.error("Swap failed:", err);
            setError("Failed to swap ranks.");
        } finally {
            setLoading(false);
        }
    };

    const handleMoveSelectedToRank = async () => {
        if (selectedProposals.length !== 1) {
            setError("Select one draft proposal to bring it to a target rank.");
            return;
        }

        const parsedRank = Number(targetRank);

        if (!Number.isInteger(parsedRank) || parsedRank < 1) {
            setError("Enter a valid target rank.");
            return;
        }

        setLoading(true);
        setError(null);
        const [proposal] = selectedProposals;

        try {
            const res = await fetch("/api/proposals/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "move",
                    entityId,
                    proposalId: proposal.id,
                    targetRank: parsedRank,
                    proposalYear: proposal.proposal_year,
                }),
            });

            if (res.ok) {
                await refreshProposals();
                setSelectedIds([]);
                setTargetRank("");
            } else {
                const payload = await res.json();
                setError(payload.error || "Failed to move proposal rank.");
            }
        } catch (err) {
            console.error("Move failed:", err);
            setError("Failed to move proposal rank.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 p-4">
            <div className="flex justify-between items-center mb-6">
                <Link
                    href="/forms/proposals"
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to List
                </Link>
            </div>
            <h2 className="text-lg font-bold">Proposal Priority Ranking</h2>
            <p className="text-sm text-muted-foreground">
                Submitted proposals are locked. Only draft proposals can be moved.
            </p>
            {lockedYear ? (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    Showing proposals for active FY {lockedYear}.
                </div>
            ) : (
                <form className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                    <label htmlFor="rank-year" className="text-sm font-medium">
                        Fiscal year
                    </label>
                    <select
                        id="rank-year"
                        name="year"
                        defaultValue={viewingYear ?? ""}
                        className="rounded border border-border bg-background px-3 py-2 text-sm"
                    >
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
            {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </div>
            )}
            <div className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-sm font-semibold">
                            Select two draft proposals to swap ranks
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {selectedProposals.length === 0
                                ? "No proposal selected."
                                : selectedProposals
                                      .map(
                                          (proposal) =>
                                              `#${proposal.priority_rank} ${proposal.title}`,
                                      )
                                      .join(" ↔ ")}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading || selectedIds.length === 0}
                            onClick={() => {
                                setSelectedIds([]);
                                setTargetRank("");
                                setError(null);
                            }}
                        >
                            Clear
                        </Button>
                        <Button
                            type="button"
                            disabled={loading || selectedProposals.length !== 2}
                            onClick={handleSwapSelected}
                            className="flex-1 bg-primary-foreground text-white hover:bg-primary-foreground/80"
                        >
                            <ArrowRightLeft size={16} />
                            {loading ? "Swapping..." : "Swap Selected Ranks"}
                        </Button>
                    </div>
                </div>
                <div className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                    <div>
                        <label
                            htmlFor="target-rank"
                            className="text-sm font-semibold"
                        >
                            Bring selected proposal to rank
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Select one draft proposal, enter a rank, and the draft proposals in between shift automatically.
                        </p>
                    </div>
                    <input
                        id="target-rank"
                        type="number"
                        min={1}
                        max={proposals.length}
                        value={targetRank}
                        onChange={(event) => setTargetRank(event.target.value)}
                        placeholder="Rank"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm md:w-32"
                        disabled={loading}
                    />
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={
                            loading ||
                            selectedProposals.length !== 1 ||
                            targetRank.trim() === ""
                        }
                        className="flex-1 bg-primary-foreground text-white hover:bg-primary-foreground/80"
                        onClick={handleMoveSelectedToRank}
                    >
                        Move to Rank
                    </Button>
                </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-3 text-left w-28">Select</th>
                            <th className="p-3 text-left w-20">Rank</th>
                            <th className="p-3 text-left">Project Title</th>
                            <th className="p-3 text-left w-36">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proposals.map((p) => {
                            const isDraft = p.auth_status === "draft";
                            const isSelected = selectedIds.includes(p.id);

                            return (
                            <tr
                                key={p.id}
                                className={`border-b last:border-0 hover:bg-slate-50 ${
                                    isSelected ? "bg-primary/10" : ""
                                } ${!isDraft ? "opacity-70" : ""}`}
                            >
                                <td className="p-3">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={isSelected ? "default" : "outline"}
                                        disabled={!isDraft || loading}
                                        onClick={() => toggleSelection(p)}
                                    >
                                        {isSelected ? "Selected" : "Select"}
                                    </Button>
                                </td>
                                <td className="p-3 font-bold text-blue-600">
                                    #{p.priority_rank}
                                </td>
                                <td className="p-3">
                                    <div className="font-medium">{p.title}</div>
                                    {p.auth_status !== "draft" && (
                                        <div className="text-xs text-muted-foreground">
                                            Submitted ranks are locked.
                                        </div>
                                    )}
                                </td>
                                <td className="p-3 capitalize text-muted-foreground">
                                    {p.auth_status?.replace(/_/g, " ") ?? "Unknown"}
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
