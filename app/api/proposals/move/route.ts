import { NextResponse } from "next/server";
import { moveProposalToRank } from "@/src/db/postgres/repositories/proposalRepository";

export async function POST(req: Request) {
    try {
        // POST /api/proposals/move
        const { entityId, proposalId, newRank, proposal_year } =
            await req.json();

        await moveProposalToRank(entityId, proposalId, newRank, proposal_year);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("MOVE ERROR:", error);
        return NextResponse.json(
            { error: "Failed to move proposal" },
            { status: 500 },
        );
    }
}
