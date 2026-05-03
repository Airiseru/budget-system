import { NextResponse } from "next/server";
import { swapProposalRanks } from "@/src/db/postgres/repositories/proposalRepository";

export async function POST(req: Request) {
    try {
        const { entityId, proposalIdA, rankA, proposalIdB, rankB } =
            await req.json();

        await swapProposalRanks(
            entityId,
            proposalIdA,
            rankA,
            proposalIdB,
            rankB,
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("SWAP ERROR:", error);
        return NextResponse.json(
            { error: "Failed to swap ranks" },
            { status: 500 },
        );
    }
}
