import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";

import {
    moveProposalToRank,
    moveDeptProposalToRank,
} from "@/src/db/postgres/repositories/proposalRepository";

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id || !session.user.entity_id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        if (
            session.user.access_level === "view" ||
            session.user.access_level === "none"
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();

        const {
            entityId,
            proposalId,
            newRank,
            proposal_year,
            proposalYear,
            scope,
        } = body;

        if (entityId !== session.user.entity_id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const year = Number(proposalYear ?? proposal_year);

        if (session.user.role === "department" && scope === "dept") {
            await moveDeptProposalToRank(proposalId, Number(newRank), year);
        } else {
            await moveProposalToRank(
                entityId,
                proposalId,
                Number(newRank),
                year,
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("MOVE ERROR:", error);

        if (
            error instanceof Error &&
            error.message === "submitted_rank_change"
        ) {
            return NextResponse.json(
                {
                    error: "Priority ranks can only be changed while proposals are drafts.",
                },
                { status: 403 },
            );
        }

        return NextResponse.json(
            { error: "Failed to move proposal" },
            { status: 500 },
        );
    }
}
