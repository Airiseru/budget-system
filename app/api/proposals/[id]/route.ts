import { NextResponse } from "next/server"
import { logSaveFormEdits, logSubmitForm } from '@/src/actions/audit'
import { auth } from "@/src/lib/auth"
import { headers } from "next/headers"
import { createProposalRepository, createFormRepository } from "@/src/db/factory"
import {
    getBudgetPrepClosedError,
    isBudgetPrepActiveForYear,
    isDbmFormActionPhaseForYear,
} from "@/src/lib/budget-cycle"
import { normalizeProposalPayload } from "@/src/lib/validations/proposal.schema"

const repo = createProposalRepository(process.env.DATABASE_TYPE || "postgres");
const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    console.log("!!! PUT REQUEST RECEIVED FOR ID:", id);
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const existing = await repo.getProjectProposalById(id);

        console.log("Existing proposal:", existing);

        if (!existing)
            return NextResponse.json(
                { error: "Project not found" },
                { status: 404 },
            );

        // LOCKING LOGIC: Same as Retirees/Staffing
        const isDbmOverwrite =
            session.user.role === "dbm" && existing.auth_status === "pending_dbm";

        if (existing.auth_status !== "draft" && !isDbmOverwrite) {
            return NextResponse.json(
                { error: "Only drafts can be updated" },
                { status: 403 },
            );
        }

        const nextStatus = body.auth_status;
        const proposalYear =
            body.payload?.proposal_year ?? existing.proposal_year;

        if (
            nextStatus === "pending_budget" &&
            !(await isBudgetPrepActiveForYear(proposalYear))
        ) {
            return NextResponse.json(
                { error: getBudgetPrepClosedError(proposalYear) },
                { status: 403 },
            );
        }

        if (
            isDbmOverwrite &&
            !(await isDbmFormActionPhaseForYear(proposalYear))
        ) {
            return NextResponse.json(
                { error: getBudgetPrepClosedError(proposalYear) },
                { status: 403 },
            );
        }

        // updateProjectProposal should handle deleting and re-inserting child arrays
        console.log("Updating proposal with payload:", body);
        const previousAuditPayload = normalizeProposalPayload(existing)
        const nextAuditPayload = normalizeProposalPayload(body.payload)
        const result = await repo.updateProjectProposal(id, body)

        // Log form edit
        const logResult = await logSaveFormEdits(
            body.userId,
            existing.entity_id,
            'project_proposals',
            id,
            previousAuditPayload,
            nextAuditPayload,
            body.updated_at,
        )

        if (!logResult.success) {
            return NextResponse.json({ error: "Failed to log form update" }, { status: 500 })
        }

        if (body.auth_status === 'pending_budget') {
            const formUpdate = await FormRepository.updateFormAuthStatus(id, body.auth_status)

            // Log form update

            const submitResult = await logSubmitForm(
                body.userId,
                existing.entity_id,
                'project_proposals',
                id,
                nextAuditPayload,
                formUpdate.updated_at,
            )

            if (!submitResult.success) {
                return NextResponse.json({ error: "Failed to log form update" }, { status: 500 })
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("PUT PROJECT ERROR:", error);
        return NextResponse.json(
            { error: "Failed to update project" },
            { status: 500 },
        );
    }

}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const existing = await repo.getProjectProposalById(id);
        if (!existing)
            return NextResponse.json({ error: "Not found" }, { status: 404 });

        if (existing.auth_status !== "draft") {
            return NextResponse.json(
                { error: "Forbidden: Only drafts can be deleted" },
                { status: 403 },
            );
        }

        await repo.deleteProjectProposal(id);
        return new NextResponse(null, { status: 204 });
    } catch {
        return NextResponse.json(
            { error: "Failed to delete" },
            { status: 500 },
        );
    }
}
