"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ProposalSummary {
    id: string;
    entity_id: string;
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
    isDepartmentUser: boolean; // pass true if the user has the "department" role
}

type Scope = "entity" | "dept";

export default function RankManager({
    initialProposals,
    entityId,
    isDepartmentUser,
}: ProposalPriorityProps) {
    const [proposals, setProposals] = useState<ProposalSummary[]>(
        initialProposals || [],
    );
    const [loading, setLoading] = useState(false);
    const [activeScope, setActiveScope] = useState<Scope>("entity");

    // Pending rank edits: { [proposalId]: inputValue }
    const [pendingRanks, setPendingRanks] = useState<Record<string, string>>(
        {},
    );

    const getRank = (p: ProposalSummary, scope: Scope) =>
        scope === "entity" ? p.priority_rank : (p.dept_priority_rank ?? 0);

    const sortedProposals = [...proposals].sort(
        (a, b) => getRank(a, activeScope) - getRank(b, activeScope),
    );

    const refetch = async () => {
        const response = await fetch(`/api/proposals?entityId=${entityId}`);
        const updatedData = await response.json();
        setProposals(updatedData);
    };

    const handleMove = async (
        currentIndex: number,
        direction: "up" | "down",
    ) => {
        const targetIndex =
            direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= sortedProposals.length) return;

        setLoading(true);
        const propA = sortedProposals[currentIndex];
        const propB = sortedProposals[targetIndex];

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
                }),
            });

            if (res.ok) await refetch();
        } catch (err) {
            console.error("Swap failed:", err);
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
        const maxRank = proposals.length;

        if (isNaN(newRank) || newRank < 1 || newRank > maxRank) {
            // Reset to current rank
            setPendingRanks((prev) => {
                const next = { ...prev };
                delete next[proposal.id];
                return next;
            });
            return;
        }

        setLoading(true);
        try {
            const body: Record<string, unknown> = {
                proposalId: proposal.id,
                newRank,
                scope: activeScope,
            };

            if (activeScope === "entity") {
                body.entityId = entityId;
            } else {
                // Pass all proposal IDs in this department view so the shift is scoped correctly
                body.proposalIds = proposals.map((p) => p.id);
            }

            const res = await fetch("/api/proposals/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                await refetch();
            }
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

    const showDeptTab = isDepartmentUser;

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

            {/* Scope toggle — only shown to department users */}
            {showDeptTab && (
                <div className="flex gap-2 mb-4">
                    <Button
                        size="sm"
                        variant={
                            activeScope === "entity" ? "default" : "outline"
                        }
                        onClick={() => setActiveScope("entity")}
                    >
                        Entity Ranking
                    </Button>
                    <Button
                        size="sm"
                        variant={activeScope === "dept" ? "default" : "outline"}
                        onClick={() => setActiveScope("dept")}
                    >
                        Department Ranking
                    </Button>
                </div>
            )}

            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-3 text-left w-32">
                                {activeScope === "entity"
                                    ? "Entity Rank"
                                    : "Dept Rank"}
                            </th>
                            <th className="p-3 text-left">Project Title</th>
                            <th className="p-3 text-center w-48">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedProposals.map((p, i) => {
                            const rank = getRank(p, activeScope);
                            const pendingVal =
                                pendingRanks[p.id] ?? String(rank);

                            return (
                                <tr
                                    key={p.id}
                                    className="border-b last:border-0 hover:bg-slate-50"
                                >
                                    <td className="p-3">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={proposals.length}
                                            value={pendingVal}
                                            disabled={loading}
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
                                                    handleRankInputCommit(p);
                                            }}
                                        />
                                    </td>
                                    <td className="p-3">{p.title}</td>
                                    <td className="p-3 flex justify-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={i === 0 || loading}
                                            onClick={() => handleMove(i, "up")}
                                        >
                                            ↑
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={
                                                i ===
                                                    sortedProposals.length -
                                                        1 || loading
                                            }
                                            onClick={() =>
                                                handleMove(i, "down")
                                            }
                                        >
                                            ↓
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
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
