import { NextResponse } from "next/server";
import { moveProposalToRank } from "@/src/db/postgres/repositories/proposalRepository";

export async function POST(req: Request) {
    try {
        // POST /api/proposals/move
        const { proposalId, newRank, scope, entityId, proposalIds } =
            await req.json();

        await moveProposalToRank(scope, proposalId, newRank, {
            entityId,
            proposalIds,
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("SWAP ERROR:", error);
        return NextResponse.json(
            { error: "Failed to swap ranks" },
            { status: 500 },
        );
    }
}
