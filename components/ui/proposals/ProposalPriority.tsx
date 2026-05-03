"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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

//  "pp.id",
//             "f.entity_id",
//             "f.codename", // e.g., "BP Form 202"
//             "pp.proposal_year",
//             "pp.priority_rank",
//             "pp.type",
//             "pp.total_proposal_cost",
//             "pp.total_proposal_currency",
//             "f.auth_status",
//             "pp.submission_date",
//             "pp.is_infrastructure",
//             "pp.title",

interface ProposalPriorityProps {
    initialProposals: ProposalSummary[];
    entityId: string;
}

export default function RankManager({
    initialProposals,
    entityId,
}: ProposalPriorityProps) {
    const [proposals, setProposals] = useState<ProposalSummary[]>(
        initialProposals || [],
    );
    const [loading, setLoading] = useState(false);

    const handleMove = async (
        currentIndex: number,
        direction: "up" | "down",
    ) => {
        const targetIndex =
            direction === "up" ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= proposals.length) return;

        setLoading(true);
        const propA = proposals[currentIndex];
        const propB = proposals[targetIndex];

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
                }),
            });

            if (res.ok) {
                // Refresh the list from the server to get the updated ranks
                const response = await fetch(
                    `/api/proposals?entityId=${entityId}`,
                );
                const updatedData = await response.json();
                setProposals(updatedData);
            }
        } catch (err) {
            console.error("Swap failed:", err);
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
            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-3 text-left w-20">Rank</th>
                            <th className="p-3 text-left">Project Title</th>
                            <th className="p-3 text-center w-40">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {proposals.map((p, i) => (
                            <tr
                                key={p.id}
                                className="border-b last:border-0 hover:bg-slate-50"
                            >
                                <td className="p-3 font-bold text-blue-600">
                                    #{p.priority_rank}
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
                                            i === proposals.length - 1 ||
                                            loading
                                        }
                                        onClick={() => handleMove(i, "down")}
                                    >
                                        ↓
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
