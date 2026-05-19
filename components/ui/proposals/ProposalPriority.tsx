"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";

interface ProposalSummary {
    id: string;
    entity_id: string;
    entity_name?: string | null; // name of the operating unit / agency the proposal belongs to
    codename: string;
    proposal_year: number;
    priority_rank: number;
    dept_priority_rank: number | null;
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
    isDepartmentUser: boolean;
    lockedYear?: number;
    viewingYear?: number;
    availableYears?: number[];
}

type Scope = "entity" | "dept";

export default function RankManager({
    initialProposals,
    entityId,
    isDepartmentUser,
    lockedYear,
    viewingYear,
    availableYears = [],
}: ProposalPriorityProps) {
    const [proposals, setProposals] = useState<ProposalSummary[]>(
        initialProposals || [],
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeScope, setActiveScope] = useState<Scope>("entity");

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [targetRank, setTargetRank] = useState("");

    const [pendingRanks, setPendingRanks] = useState<Record<string, string>>(
        {},
    );

    // Department users can only edit dept priority ranks.
    // Entity scope is read-only for them — they can see all entity rankings
    // across related operating units/agencies but cannot change them.
    const isReadOnly = isDepartmentUser && activeScope === "entity";

    useEffect(() => {
        setProposals(initialProposals || []);
        setSelectedIds([]);
        setTargetRank("");
        setError(null);
    }, [initialProposals, viewingYear]);

    // Switch scope: clear selections and errors
    const handleScopeChange = (scope: Scope) => {
        setActiveScope(scope);
        setSelectedIds([]);
        setTargetRank("");
        setError(null);
    };

    const getRank = (p: ProposalSummary, scope: Scope) => {
        return scope === "entity" ? p.priority_rank : p.dept_priority_rank;
    };

    const visibleProposals = proposals.filter((p) => {
        const rank = getRank(p, activeScope);
        return rank !== null && rank !== undefined;
    });

    const sortedProposals = [...visibleProposals].sort((a, b) => {
        const rankA = Number(getRank(a, activeScope));
        const rankB = Number(getRank(b, activeScope));
        return rankA - rankB;
    });

    const selectedProposals = selectedIds
        .map((id) => proposals.find((p) => p.id === id))
        .filter((p): p is ProposalSummary => Boolean(p));

    const refreshProposals = async () => {
        const params = new URLSearchParams();
        params.set("entityId", entityId);
        if (viewingYear) {
            params.set("year", String(viewingYear));
        }
        const response = await fetch(`/api/proposals?${params.toString()}`);
        if (!response.ok) {
            throw new Error("Failed to refresh proposals");
        }
        const updatedData = await response.json();
        setProposals(updatedData);
    };

    const toggleSelection = (proposal: ProposalSummary) => {
        if (isReadOnly || proposal.auth_status !== "draft" || loading) return;
        setError(null);
        setSelectedIds((current) => {
            if (current.includes(proposal.id)) {
                return current.filter((id) => id !== proposal.id);
            }
            return [...current.slice(-1), proposal.id];
        });
    };

    const handleSwapSelected = async () => {
        if (selectedProposals.length !== 2) {
            setError(
                "Select two draft proposals to swap their priority ranks.",
            );
            return;
        }
        setLoading(true);
        setError(null);
        const [propA, propB] = selectedProposals;

        if (propA.auth_status !== "draft" || propB.auth_status !== "draft") {
            setError(
                "Priority ranks can only be changed while both proposals are drafts.",
            );
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/proposals/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scope: activeScope,
                    entityId,
                    proposalIdA: propA.id,
                    rankA: getRank(propA, activeScope),
                    proposalIdB: propB.id,
                    rankB: getRank(propB, activeScope),
                    proposalYear: propA.proposal_year,
                }),
            });

            if (res.ok) {
                setSelectedIds([]);
                await refreshProposals();
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
            const res = await fetch("/api/proposals/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entityId,
                    proposalId: proposal.id,
                    newRank: parsedRank,
                    proposalYear: proposal.proposal_year,
                    scope: activeScope,
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

    const handleRankInputChange = (proposalId: string, value: string) => {
        setPendingRanks((prev) => ({ ...prev, [proposalId]: value }));
    };

    const handleRankInputCommit = async (proposal: ProposalSummary) => {
        const raw = pendingRanks[proposal.id];
        if (!raw) return;

        const newRank = parseInt(raw, 10);
        const maxRank = sortedProposals.length;

        if (isNaN(newRank) || newRank < 1 || newRank > maxRank) {
            setPendingRanks((prev) => {
                const next = { ...prev };
                delete next[proposal.id];
                return next;
            });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/proposals/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entityId,
                    proposalId: proposal.id,
                    newRank,
                    scope: activeScope,
                    proposalYear: proposal.proposal_year,
                }),
            });

            if (res.ok) await refreshProposals();
        } catch (err) {
            console.error("Move failed:", err);
        } finally {
            setLoading(false);
            setPendingRanks((prev) => {
                const next = { ...prev };
                delete next[proposal.id];
                return next;
            });
        }
    };

    const swapProposals = async (
        propA: ProposalSummary,
        propB: ProposalSummary,
    ) => {
        if (propA.auth_status !== "draft" || propB.auth_status !== "draft") {
            setError(
                "Priority ranks can only be changed while both proposals are drafts.",
            );
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/proposals/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scope: activeScope,
                    entityId,
                    proposalIdA: propA.id,
                    rankA: getRank(propA, activeScope),
                    proposalIdB: propB.id,
                    rankB: getRank(propB, activeScope),
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

    return (
        <div className="space-y-4 p-4">
            <LoadingOverlay show={loading} label="Updating proposal ranks..." />
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
                Submitted proposals are locked. Only draft proposals can be
                moved.
            </p>

            {isDepartmentUser && (
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant={
                            activeScope === "entity" ? "default" : "outline"
                        }
                        onClick={() => handleScopeChange("entity")}
                    >
                        Entity Ranking
                    </Button>
                    <Button
                        size="sm"
                        variant={activeScope === "dept" ? "default" : "outline"}
                        onClick={() => handleScopeChange("dept")}
                    >
                        Department Ranking
                    </Button>
                </div>
            )}

            {/* Dept user viewing entity scope: show read-only notice */}
            {isReadOnly && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    Entity rankings are read-only. Switch to{" "}
                    <button
                        className="underline font-medium"
                        onClick={() => handleScopeChange("dept")}
                    >
                        Department Ranking
                    </button>{" "}
                    to reorder proposals.
                </div>
            )}

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

            {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Swap / Move controls — hidden entirely when read-only */}
            {!isReadOnly && (
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
                                              (p) =>
                                                  `#${getRank(p, activeScope)} ${p.title}`,
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
                                disabled={
                                    loading || selectedProposals.length !== 2
                                }
                                onClick={handleSwapSelected}
                                className="flex-1 bg-primary-foreground text-white hover:bg-primary-foreground/80"
                            >
                                <ArrowRightLeft size={16} />
                                {loading
                                    ? "Swapping..."
                                    : "Swap Selected Ranks"}
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
                                Select one draft proposal, enter a rank, and the
                                draft proposals in between shift automatically.
                            </p>
                        </div>
                        <input
                            id="target-rank"
                            type="number"
                            min={1}
                            max={sortedProposals.length}
                            value={targetRank}
                            onChange={(e) => setTargetRank(e.target.value)}
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
            )}

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            {/* Select column hidden when read-only */}
                            {!isReadOnly && (
                                <th className="p-3 text-left w-28">Select</th>
                            )}
                            <th className="p-3 text-left w-32">
                                {activeScope === "entity"
                                    ? "Entity Rank"
                                    : "Dept Rank"}
                            </th>
                            {/* Entity name column only shown for dept users in entity scope */}
                            {isDepartmentUser && activeScope === "entity" && (
                                <th className="p-3 text-left w-48">Entity</th>
                            )}
                            <th className="p-3 text-left">Project Title</th>
                            <th className="p-3 text-left w-32">Status</th>
                            {/* Actions column hidden when read-only */}
                            {!isReadOnly && (
                                <th className="p-3 text-center w-40">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedProposals.map((p, i) => {
                            const rank = getRank(p, activeScope);
                            const pendingVal =
                                pendingRanks[p.id] ?? String(rank);
                            const isDraft = p.auth_status === "draft";
                            const isSelected = selectedIds.includes(p.id);

                            return (
                                <tr
                                    key={p.id}
                                    className={`border-b last:border-0 hover:bg-slate-50 transition-colors ${
                                        isSelected ? "bg-primary/10" : ""
                                    } ${!isDraft ? "opacity-70" : ""}`}
                                >
                                    {/* Select button — hidden when read-only */}
                                    {!isReadOnly && (
                                        <td className="p-3">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={
                                                    isSelected
                                                        ? "default"
                                                        : "outline"
                                                }
                                                disabled={!isDraft || loading}
                                                onClick={() =>
                                                    toggleSelection(p)
                                                }
                                            >
                                                {isSelected
                                                    ? "Selected"
                                                    : "Select"}
                                            </Button>
                                        </td>
                                    )}

                                    {/* Rank cell: read-only badge for dept users in entity scope,
                                        editable input otherwise */}
                                    <td className="p-3">
                                        {isReadOnly ? (
                                            <span className="inline-flex items-center justify-center w-20 h-8 rounded-md border border-slate-200 bg-slate-50 text-center font-bold text-slate-600 text-sm">
                                                {rank}
                                            </span>
                                        ) : (
                                            <Input
                                                type="number"
                                                min={1}
                                                max={sortedProposals.length}
                                                value={pendingVal}
                                                disabled={loading || !isDraft}
                                                className="w-20 text-center font-bold text-blue-600"
                                                onChange={(e) =>
                                                    handleRankInputChange(
                                                        p.id,
                                                        e.target.value,
                                                    )
                                                }
                                                onBlur={() =>
                                                    handleRankInputCommit(p)
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter")
                                                        handleRankInputCommit(
                                                            p,
                                                        );
                                                }}
                                            />
                                        )}
                                    </td>

                                    {/* Entity name — only for dept users viewing entity scope */}
                                    {isDepartmentUser &&
                                        activeScope === "entity" && (
                                            <td className="p-3 text-sm text-muted-foreground">
                                                {p.entity_name ?? "—"}
                                            </td>
                                        )}

                                    <td className="p-3">
                                        <div className="font-medium">
                                            {p.title}
                                        </div>
                                        {!isDraft && (
                                            <div className="text-xs text-muted-foreground">
                                                Submitted ranks are locked.
                                            </div>
                                        )}
                                    </td>

                                    <td className="p-3 capitalize text-muted-foreground">
                                        {p.auth_status?.replace(/_/g, " ") ??
                                            "Unknown"}
                                    </td>

                                    {/* ↑↓ buttons — hidden when read-only */}
                                    {!isReadOnly && (
                                        <td className="p-3 flex justify-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    i === 0 ||
                                                    loading ||
                                                    !isDraft
                                                }
                                                onClick={() => {
                                                    const propB =
                                                        sortedProposals[i - 1];
                                                    swapProposals(p, propB);
                                                }}
                                            >
                                                ↑
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    i ===
                                                        sortedProposals.length -
                                                            1 ||
                                                    loading ||
                                                    !isDraft
                                                }
                                                onClick={() => {
                                                    const propB =
                                                        sortedProposals[i + 1];
                                                    swapProposals(p, propB);
                                                }}
                                            >
                                                ↓
                                            </Button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}

                        {sortedProposals.length === 0 && (
                            <tr>
                                <td
                                    colSpan={
                                        // account for variable column count
                                        (isReadOnly ? 0 : 2) +
                                        (isDepartmentUser &&
                                        activeScope === "entity"
                                            ? 1
                                            : 0) +
                                        2
                                    }
                                    className="p-6 text-center text-muted-foreground"
                                >
                                    No proposals found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {activeScope === "dept" && (
                <p className="text-xs text-slate-500 mt-2">
                    Department-wide ranking across all entities. Changes affect
                    all proposals in the department.
                </p>
            )}
        </div>
    );
}
