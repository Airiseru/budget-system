import { NextResponse } from "next/server"
import { logFormOverwrite, logNewForm, logSaveFormEdits, logSubmitForm } from '@/src/actions/audit'
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

function withSchemaPapId<T extends { is_new?: boolean; pap_id?: string | null; existing_pap_id?: string | null }>(
    proposal: T | null | undefined,
) {
    if (!proposal) return proposal
    const existingPapId = proposal.is_new === false
        ? proposal.existing_pap_id ?? proposal.pap_id ?? ""
        : proposal.existing_pap_id ?? ""

    return {
        ...proposal,
        existing_pap_id: existingPapId,
    }
}

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
        const isDbm = body.isDbm ?? body.isDBM ?? false
        const overrideRemarks =
            typeof body.overrideRemarks === "string" ? body.overrideRemarks.trim() : ""
        const existing = await repo.getProjectProposalById(id);

        console.log("Existing proposal:", existing);

        if (!existing)
            return NextResponse.json(
                { error: "Project not found" },
                { status: 404 },
            );

        const isDbmOverwrite =
            isDbm && session.user.role === "dbm" && existing.auth_status === "pending_dbm";

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

        if (isDbmOverwrite && !overrideRemarks) {
            return NextResponse.json(
                { error: "DBM remarks are required when overwriting or changing this form." },
                { status: 400 },
            );
        }

        if (isDbmOverwrite && (await FormRepository.hasApprovedFormInFamily(id))) {
            return NextResponse.json(
                { error: "This form version family is locked because a DBM-approved version already exists." },
                { status: 403 },
            );
        }

        console.log("Updating proposal with payload:", body);
        const previousAuditPayload = normalizeProposalPayload(withSchemaPapId(existing))
        const result = isDbmOverwrite
            ? await repo.createDbmProjectProposalOverwrite(id, body)
            : {
                  ...(await repo.updateProjectProposal(id, body)),
                  formId: id,
                  created: false,
              }
        const targetFormId = result.formId
        const updated = await repo.getProjectProposalById(targetFormId)
        const nextAuditPayload = normalizeProposalPayload(withSchemaPapId(updated) ?? body.payload)
        const changedAt = updated?.updated_at ?? new Date()

        if (result.created && updated) {
            const logCreateResult = await logNewForm(
                body.userId,
                existing.entity_id,
                'project_proposals',
                targetFormId,
                nextAuditPayload,
                updated.created_at,
            )

            if (!logCreateResult.success) {
                return NextResponse.json({ error: "Failed to log overwritten form creation" }, { status: 500 })
            }
        }

        if (!isDbmOverwrite) {
            const logResult = await logSaveFormEdits(
                body.userId,
                existing.entity_id,
                'project_proposals',
                targetFormId,
                previousAuditPayload,
                nextAuditPayload,
                changedAt,
            )

            if (!logResult.success) {
                return NextResponse.json({ error: "Failed to log form update" }, { status: 500 })
            }
        }

        if (body.auth_status === 'pending_budget') {
            const formUpdate = await FormRepository.updateFormAuthStatus(targetFormId, body.auth_status)

            // Log form update

            const submitResult = await logSubmitForm(
                body.userId,
                existing.entity_id,
                'project_proposals',
                targetFormId,
                nextAuditPayload,
                formUpdate.updated_at,
            )

            if (!submitResult.success) {
                return NextResponse.json({ error: "Failed to log form update" }, { status: 500 })
            }
        }
        else if (body.auth_status === 'pending_dbm') {
            const formUpdate = await FormRepository.updateFormAuthStatus(targetFormId, body.auth_status)
            const overwriteLogResult = await logFormOverwrite(
                body.userId,
                existing.entity_id,
                'project_proposals',
                targetFormId,
                previousAuditPayload,
                nextAuditPayload,
                formUpdate.updated_at,
                overrideRemarks,
            )

            if (!overwriteLogResult.success) {
                return NextResponse.json({ error: "Failed to log form overwrite" }, { status: 500 })
            }
        }

        return NextResponse.json({ ...result, formId: targetFormId });
    } catch (error) {
        console.error("PUT PROJECT ERROR:", error);
        if (error instanceof Error && error.message === "unique_entity_rank") {
            return NextResponse.json(
                {
                    code: "23505",
                    error: "This priority rank is already taken by another proposal.",
                },
                { status: 409 },
            );
        }

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
