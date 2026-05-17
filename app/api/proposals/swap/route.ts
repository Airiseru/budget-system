import { NextResponse } from "next/server";
import {
    swapProposalRanks,
    swapDeptProposalRanks,
} from "@/src/db/postgres/repositories/proposalRepository";

export async function POST(req: Request) {
    try {
        const { entityId, proposalIdA, rankA, proposalIdB, rankB, scope } =
            await req.json();

        if (scope === "dept") {
            await swapDeptProposalRanks(proposalIdA, rankA, proposalIdB, rankB);
        } else {
            await swapProposalRanks(
                entityId,
                proposalIdA,
                rankA,
                proposalIdB,
                rankB,
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("SWAP ERROR:", error);
        return NextResponse.json(
            { error: "Failed to swap ranks" },
            { status: 500 },
        );
    }
}
