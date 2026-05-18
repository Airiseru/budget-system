import { NextResponse } from "next/server"
import { auth } from "@/src/lib/auth"
import { headers } from "next/headers"
import { createProposalRepository } from "@/src/db/factory"
import { logSaveFormEdits } from "@/src/actions/audit"
import { normalizeProposalPayload } from "@/src/lib/validations/proposal.schema"
import {
    moveProposalToRank,
    swapDeptProposalRanks,
    swapProposalRanks,
} from "@/src/db/postgres/repositories/proposalRepository"

const ProposalRepository = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
)

type AuditRankChange = {
    recordId: string
    previousPayload: Record<string, unknown>
    nextPayload: Record<string, unknown>
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
        )

        if (!result.success) return result
    }

    return { success: true }
}

export async function POST(req: Request) {
    try {
        const session = await auth.api.getSession({ headers: await headers() })

        if (!session?.user?.id || !session.user.entity_id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (session.user.access_level !== "encode") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const body = await req.json()
        const { entityId } = body

        if (entityId !== session.user.entity_id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        if (body.action === "move") {
            const { proposalId, targetRank } = body
            const requestedYear = Number(body.proposalYear ?? body.proposal_year)
            const movingProposal = await ProposalRepository.getProjectProposalById(
                proposalId,
            )

            if (!movingProposal) {
                return NextResponse.json(
                    { error: "Proposal not found" },
                    { status: 404 },
                )
            }

            const proposalYear = Number.isInteger(requestedYear)
                ? requestedYear
                : movingProposal.proposal_year

            if (movingProposal.proposal_year !== proposalYear) {
                return NextResponse.json(
                    { error: "Proposal year mismatch" },
                    { status: 400 },
                )
            }

            const currentProposals = await ProposalRepository.getAllProposalSummaries(
                session.user.id,
                "admin",
                entityId,
                proposalYear,
            )
            const movingSummary = currentProposals.find(
                (proposal) => proposal.id === proposalId,
            )

            if (!movingSummary) {
                return NextResponse.json(
                    { error: "Proposal not found" },
                    { status: 404 },
                )
            }


            const boundedTargetRank = Math.max(
                1,
                Math.min(Math.trunc(Number(targetRank)), currentProposals.length),
            )
            const currentRank = Number(movingSummary.priority_rank)
            const affectedIds = currentProposals
                .filter((proposal) => {
                    const rank = Number(proposal.priority_rank)

                    return currentRank < boundedTargetRank
                        ? rank >= currentRank && rank <= boundedTargetRank
                        : rank >= boundedTargetRank && rank <= currentRank
                })
                .map((proposal) => proposal.id)

            const previousProposals = await Promise.all(
                affectedIds.map((id: string) =>
                    ProposalRepository.getProjectProposalById(id),
                ),
            )

            if (previousProposals.some((proposal) => !proposal)) {
                return NextResponse.json(
                    { error: "Proposal not found" },
                    { status: 404 },
                )
            }

            if (
                previousProposals.some(
                    (proposal) => proposal?.auth_status !== "draft",
                )
            ) {
                return NextResponse.json(
                    { error: "Priority ranks can only be changed while all affected proposals are drafts." },
                    { status: 403 },
                )
            }

            const result = await moveProposalToRank(
                entityId,
                proposalId,
                Number(targetRank),
                proposalYear,
            )
            const changedIds = result.changedIds
            const changedPreviousProposals = previousProposals.filter(
                (proposal) => proposal && changedIds.includes(proposal.id),
            ) as NonNullable<(typeof previousProposals)[number]>[]
            const updatedProposals = await Promise.all(
                changedIds.map((id: string) =>
                    ProposalRepository.getProjectProposalById(id),
                ),
            )
            const changedAt = new Date()
            const logResult = await logRankChangesSequentially(
                session.user.id,
                entityId,
                changedPreviousProposals.map((previousProposal) => {
                    const updatedProposal = updatedProposals.find(
                        (proposal) => proposal?.id === previousProposal.id,
                    )

                    if (!updatedProposal) {
                        return {
                            recordId: previousProposal.id,
                            previousPayload: normalizeProposalPayload(previousProposal),
                            nextPayload: normalizeProposalPayload(previousProposal),
                        }
                    }

                    return {
                        recordId: previousProposal.id,
                        previousPayload: normalizeProposalPayload(previousProposal),
                        nextPayload: normalizeProposalPayload(updatedProposal),
                    }
                }),
                changedAt,
            )

            if (!logResult.success) {
                return NextResponse.json(
                    { error: "Ranks were moved but audit logging failed." },
                    { status: 500 },
                )
            }

            return NextResponse.json({ success: true })
        }

        const { proposalIdA, rankA, proposalIdB, rankB } = body
        const requestedYear = Number(body.proposalYear ?? body.proposal_year)

        const [proposalA, proposalB] = await Promise.all([
            ProposalRepository.getProjectProposalById(proposalIdA),
            ProposalRepository.getProjectProposalById(proposalIdB),
        ])

        if (!proposalA || !proposalB) {
            return NextResponse.json(
                { error: "Proposal not found" },
                { status: 404 },
            )
        }

        const proposalYear = Number.isInteger(requestedYear)
            ? requestedYear
            : proposalA.proposal_year

        if (
            proposalA.proposal_year !== proposalYear ||
            proposalB.proposal_year !== proposalYear
        ) {
            return NextResponse.json(
                { error: "Proposal year mismatch" },
                { status: 400 },
            )
        }

        if (proposalA.auth_status !== "draft" || proposalB.auth_status !== "draft") {
            return NextResponse.json(
                { error: "Priority ranks can only be changed while both proposals are drafts." },
                { status: 403 },
            )
        }

        const previousA = normalizeProposalPayload(proposalA)
        const previousB = normalizeProposalPayload(proposalB)

        if (session.user.role === "department") {
            await swapDeptProposalRanks(proposalIdA, rankA, proposalIdB, rankB)
        }
        else {
            await swapProposalRanks(
                entityId,
                proposalIdA,
                rankA,
                proposalIdB,
                rankB,
                proposalYear,
            )
        }

        const [updatedA, updatedB] = await Promise.all([
            ProposalRepository.getProjectProposalById(proposalIdA),
            ProposalRepository.getProjectProposalById(proposalIdB),
        ])

        if (!updatedA || !updatedB) {
            return NextResponse.json(
                { error: "Failed to reload swapped proposals" },
                { status: 500 },
            )
        }

        const changedAt = new Date()
        const logResult = await logRankChangesSequentially(
            session.user.id,
            entityId,
            [
                {
                    recordId: proposalIdA,
                    previousPayload: previousA,
                    nextPayload: normalizeProposalPayload(updatedA),
                },
                {
                    recordId: proposalIdB,
                    previousPayload: previousB,
                    nextPayload: normalizeProposalPayload(updatedB),
                },
            ],
            changedAt,
        )

        if (!logResult.success) {
            return NextResponse.json(
                { error: "Ranks were swapped but audit logging failed." },
                { status: 500 },
            )
        }

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        console.error("SWAP ERROR:", error)
        if (
            error instanceof Error &&
            (error.message === "submitted_rank_change" ||
                error.message === "unique_entity_rank")
        ) {
            return NextResponse.json(
                {
                    error:
                        error.message === "submitted_rank_change"
                            ? "Priority ranks can only be changed while both proposals are drafts."
                            : "This priority rank is already taken by another proposal.",
                },
                { status: 403 },
            )
        }

        return NextResponse.json(
            { error: "Failed to swap ranks" },
            { status: 500 },
        )
    }
}