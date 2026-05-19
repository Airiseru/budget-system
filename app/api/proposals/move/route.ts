import { NextResponse } from "next/server";
import { sessionWithEntity } from "@/src/actions/auth";
import { logSaveFormEdits } from "@/src/actions/audit";
import { createProposalRepository } from "@/src/db/factory";
import { normalizeProposalPayload } from "@/src/lib/validations/proposal.schema";
import {
    getAllProposalSummaries,
    moveProposalToRank,
    moveDeptProposalToRank,
} from "@/src/db/postgres/repositories/proposalRepository";

const ProposalRepository = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);

type AuditRankChange = {
    recordId: string;
    previousPayload: Record<string, unknown>;
    nextPayload: Record<string, unknown>;
};

function withSchemaPapId<T extends { is_new?: boolean | null; pap_id?: string | null; existing_pap_id?: string | null }>(
    proposal: T,
) {
    const existingPapId = proposal.is_new === false
        ? proposal.existing_pap_id ?? proposal.pap_id ?? ""
        : proposal.existing_pap_id ?? "";

    return {
        ...proposal,
        existing_pap_id: existingPapId,
    };
}

function normalizeAuditProposalPayload(
    proposal: Parameters<typeof withSchemaPapId>[0],
) {
    return normalizeProposalPayload(withSchemaPapId(proposal));
}

async function logRankChangesSequentially(
    userId: string,
    entityId: string,
    changes: AuditRankChange[],
    changedAt: Date,
) {
    for (const change of changes) {
        const result = await logSaveFormEdits(
            userId,
            entityId,
            "project_proposals",
            change.recordId,
            change.previousPayload,
            change.nextPayload,
            changedAt,
        );

        if (!result.success) return result;
    }

    return { success: true };
}

export async function POST(req: Request) {
    try {
        const session = await sessionWithEntity();

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
        const currentProposals = await getAllProposalSummaries(
            session.user_entity.entity_type || "",
            session.user.role,
            entityId,
            year,
        );
        const movingSummary = currentProposals.find(
            (proposal) => proposal.id === proposalId,
        );

        if (!movingSummary) {
            return NextResponse.json(
                { error: "Proposal not found" },
                { status: 404 },
            );
        }

        const rankField = session.user.role === "department" && scope === "dept"
            ? "dept_priority_rank"
            : "priority_rank";
        const currentRank = Number(movingSummary[rankField]);
        const boundedTargetRank = Math.max(
            1,
            Math.min(Math.trunc(Number(newRank)), currentProposals.length),
        );
        const affectedIds = currentProposals
            .filter((proposal) => {
                const rank = Number(proposal[rankField]);

                return currentRank < boundedTargetRank
                    ? rank >= currentRank && rank <= boundedTargetRank
                    : rank >= boundedTargetRank && rank <= currentRank;
            })
            .map((proposal) => proposal.id);

        const previousProposals = await Promise.all(
            affectedIds.map((id: string) =>
                ProposalRepository.getProjectProposalById(id),
            ),
        );

        if (previousProposals.some((proposal) => !proposal)) {
            return NextResponse.json(
                { error: "Proposal not found" },
                { status: 404 },
            );
        }

        const result = session.user.role === "department" && scope === "dept"
            ? await moveDeptProposalToRank(proposalId, Number(newRank), year)
            : await moveProposalToRank(
                entityId,
                proposalId,
                Number(newRank),
                year,
            );
        const changedPreviousProposals = previousProposals.filter(
            (proposal) => proposal && result.changedIds.includes(proposal.id),
        ) as NonNullable<(typeof previousProposals)[number]>[];
        const updatedProposals = await Promise.all(
            result.changedIds.map((id: string) =>
                ProposalRepository.getProjectProposalById(id),
            ),
        );
        const changedAt = new Date();
        const logResult = await logRankChangesSequentially(
            session.user.id,
            entityId,
            changedPreviousProposals.map((previousProposal) => {
                const updatedProposal = updatedProposals.find(
                    (proposal) => proposal?.id === previousProposal.id,
                );

                return {
                    recordId: previousProposal.id,
                    previousPayload:
                        normalizeAuditProposalPayload(previousProposal),
                    nextPayload: normalizeAuditProposalPayload(
                        updatedProposal ?? previousProposal,
                    ),
                };
            }),
            changedAt,
        );

        if (!logResult.success) {
            return NextResponse.json(
                { error: "Rank was moved but audit logging failed." },
                { status: 500 },
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
