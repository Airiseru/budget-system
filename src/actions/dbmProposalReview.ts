"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDbm } from "./admin";
import { db } from "../db/postgres/database";
import { sql } from "kysely";
import {
    createAuditRepository,
    createBudgetSettingsRepository,
    createEntityRepository,
    createProposalRepository,
    createFormRepository,
    createKeyRepository,
    createPapRepository,
} from "../db/factory";
import { sessionWithEntity } from "./auth";
import { verifySigningPin } from "./keys";
import { fetchHydratedFormState } from "../db/postgres/repositories/formHydrator";
import { buildSignaturePayload, sha256 } from "../lib/audit-hash";
import { canonicalStringify } from "../lib/canonical";
import { canSign, getNextStatus, getWorkflow } from "../lib/workflows";
import { verifySignature } from "../lib/crypto";
import { FormSignaturePayload } from "../types/audit";
import { cleanDataBasedOnTable } from "../lib/validations";

const ProposalRepository = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const BudgetSettingsRepository = createBudgetSettingsRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const EntityRepository = createEntityRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const FormRepository = createFormRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const PapRepository = createPapRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const KeyRepository = createKeyRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const AuditRepository = createAuditRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const PAGE_SIZE = 20;

const RejectProposalSchema = z.object({
    proposal_id: z.string().uuid(),
});

const PrepareBulkRejectScopeSchema = z.object({
    fiscalYear: z.number().int(),
    scopeType: z.enum(["department", "agency", "operating_unit"]),
    scopeId: z.string().uuid(),
    remarks: z.string().trim().min(1, "Remarks are required."),
});

const BulkRejectSignatureSchema = z.object({
    proposalId: z.string().uuid(),
    payload: z.object({
        from_status: z.string(),
        to_status: z.string(),
        form_state_hash: z.string(),
        remarks: z.string().optional(),
    }),
    changedAt: z.string(),
    signaturePayload: z.string(),
    signature: z.string().min(1),
});

const SubmitSignedBulkRejectSchema = z.object({
    pin: z.string().regex(/^\d{6}$/, "PIN must be 6 digits."),
    keyId: z.string().uuid(),
    fiscalYear: z.number().int(),
    scopeType: z.enum(["department", "agency", "operating_unit"]),
    scopeId: z.string().uuid(),
    signatures: z.array(BulkRejectSignatureSchema).min(1),
});

async function getPendingDbmProposalsForScope(input: {
    fiscalYear: number
    scopeType: "department" | "agency" | "operating_unit"
    scopeId: string
}) {
    return await ProposalRepository.listDbmProposalReviewRows({
        fiscalYear: input.fiscalYear,
        status: "pending_dbm",
        departmentId: input.scopeType === "department" ? input.scopeId : undefined,
        agencyId: input.scopeType === "agency" ? input.scopeId : undefined,
        operatingUnitId: input.scopeType === "operating_unit" ? input.scopeId : undefined,
    });
}

async function getLatestAuditTimestampByEntityIds(entityIds: string[]) {
    const uniqueEntityIds = Array.from(new Set(entityIds));

    if (uniqueEntityIds.length === 0) {
        return new Map<string, Date>();
    }

    const rows = await db
        .selectFrom("audit_logs")
        .select([
            "entity_id",
            sql<Date>`max(changed_at)`.as("latest_changed_at"),
        ])
        .where("entity_id", "in", uniqueEntityIds)
        .groupBy("entity_id")
        .execute();

    return new Map(
        rows
            .filter((row) => row.latest_changed_at)
            .map((row) => [
                row.entity_id,
                new Date(row.latest_changed_at),
            ]),
    );
}

export async function loadDbmProposalReview(params: {
    year?: number;
    status?: string;
    departmentId?: string;
    agencyId?: string;
    operatingUnitId?: string;
    search?: string;
    page?: number;
}) {
    await requireDbm();

    const [
        cycles,
        activeCycle,
        entitySegments,
    ] = await Promise.all([
        BudgetSettingsRepository.listBudgetCycles(),
        BudgetSettingsRepository.getActiveBudgetCycle(),
        EntityRepository.getAllEntitySegments(true),
    ]);

    const viewingYear =
        params.year ?? activeCycle?.fiscal_year ?? cycles[0]?.fiscal_year;
    const page = Math.max(1, params.page ?? 1);
    const filters = {
        fiscalYear: viewingYear,
        status: params.status || "pending_dbm",
        departmentId: params.departmentId,
        agencyId: params.agencyId,
        operatingUnitId: params.operatingUnitId,
        search: params.search ?? "",
    };

    const [rows, totalCount] = await Promise.all([
        ProposalRepository.listDbmProposalReviewRows({
            ...filters,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
        }),
        ProposalRepository.countDbmProposalReviewRows(filters),
    ]);

    return {
        rows,
        totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
        page,
        viewingYear,
        availableYears: cycles.map((cycle) => cycle.fiscal_year),
        selectedStatus: filters.status,
        selectedDepartmentId: params.departmentId ?? "all",
        selectedAgencyId: params.agencyId ?? "all",
        selectedOperatingUnitId: params.operatingUnitId ?? "all",
        search: filters.search,
        departments: entitySegments.departments,
        agencies: entitySegments.agencies,
        operatingUnits: entitySegments.operatingUnits,
    };
}

export async function rejectProposalAction(formData: FormData) {
    await requireDbm();
    const session = await sessionWithEntity();
    if (!session) throw new Error("Unauthorized");

    const parsed = RejectProposalSchema.parse({
        proposal_id: formData.get("proposal_id"),
    });
    await db.transaction().execute(async (trx) => {
        await FormRepository.updateFormAuthStatusWithExecutor(parsed.proposal_id, "rejected", trx);
        await PapRepository.updatePapProjectStatusForFormWithExecutor(
            trx,
            parsed.proposal_id,
            "rejected",
        );
        await ProposalRepository.rejectProposalAllocationsWithExecutor(
            trx,
            parsed.proposal_id,
            session.user.id,
        );
    });
    revalidatePath("/dbm/proposals");
}

export async function prepareBulkProposalRejectPayloads(input: {
    fiscalYear: number
    scopeType: "department" | "agency" | "operating_unit"
    scopeId: string
    remarks: string
}) {
    await requireDbm();
    const session = await sessionWithEntity();
    if (!session) throw new Error("Unauthorized");

    const parsed = PrepareBulkRejectScopeSchema.parse(input);
    const proposals = await getPendingDbmProposalsForScope(parsed);
    if (proposals.length === 0) {
        throw new Error("No pending DBM proposals match this scope.");
    }

    const latestAuditTimestampByEntityId =
        await getLatestAuditTimestampByEntityIds(
            proposals.map((proposal) => proposal.entity_id),
        );
    const nextTimestampByEntityId = new Map<string, number>();
    const preparedAt = Date.now();
    const changedAtByProposalId = new Map<string, Date>();

    for (const [index, proposal] of proposals.entries()) {
        const latestEntityAuditTime =
            latestAuditTimestampByEntityId.get(proposal.entity_id)?.getTime() ?? 0;
        const previousPreparedTime =
            nextTimestampByEntityId.get(proposal.entity_id) ?? latestEntityAuditTime;
        const changedAtTime = Math.max(preparedAt + index, previousPreparedTime + 1);

        nextTimestampByEntityId.set(proposal.entity_id, changedAtTime);
        changedAtByProposalId.set(proposal.id, new Date(changedAtTime));
    }

    return await Promise.all(proposals.map(async (proposal) => {
        const formState = await fetchHydratedFormState("project_proposals", proposal.id);
        const cleanFormState = cleanDataBasedOnTable(
            "project_proposals",
            formState,
        );
        const payload = {
            from_status: proposal.auth_status ?? "",
            to_status: "rejected",
            form_state_hash: sha256(canonicalStringify(cleanFormState)),
            remarks: parsed.remarks,
        } satisfies FormSignaturePayload;
        const changedAt = changedAtByProposalId.get(proposal.id);

        if (!changedAt) {
            throw new Error("Failed to prepare signed rejection timestamp.");
        }

        const signaturePayload = buildSignaturePayload({
            entity_id: proposal.entity_id,
            user_id: session.user.id,
            event_type: "REJECT_FORM",
            table_name: "project_proposals",
            record_id: proposal.id,
            payload,
            changed_at: changedAt,
        });

        return {
            proposalId: proposal.id,
            title: proposal.title,
            entityName: proposal.entity_name,
            payload,
            changedAt: changedAt.toISOString(),
            signaturePayload,
        };
    }));
}

export async function submitSignedBulkProposalReject(input: {
    pin: string
    keyId: string
    fiscalYear: number
    scopeType: "department" | "agency" | "operating_unit"
    scopeId: string
    signatures: {
        proposalId: string
        payload: FormSignaturePayload
        changedAt: string
        signaturePayload: string
        signature: string
    }[]
}) {
    await requireDbm();
    const session = await sessionWithEntity();
    if (!session) throw new Error("Unauthorized");

    const parsed = SubmitSignedBulkRejectSchema.parse(input);
    if (!await verifySigningPin(parsed.pin)) throw new Error("Incorrect PIN");

    const key = await KeyRepository.getUserKeyById(parsed.keyId);
    if (!key || key.user_id !== session.user.id) throw new Error("Invalid key");
    if (key.status !== "active") throw new Error("Key is no longer active");
    if (key.expires_at && key.expires_at < new Date()) throw new Error("Key has expired");

    const scopedProposals = await getPendingDbmProposalsForScope(parsed);
    const scopedProposalIds = new Set(scopedProposals.map((proposal) => proposal.id));
    const signatureProposalIds = new Set(parsed.signatures.map((item) => item.proposalId));

    if (scopedProposalIds.size !== signatureProposalIds.size) {
        throw new Error("The proposal scope changed before signing completed. Please retry.");
    }

    for (const proposalId of scopedProposalIds) {
        if (!signatureProposalIds.has(proposalId)) {
            throw new Error("The proposal scope changed before signing completed. Please retry.");
        }
    }

    const orderedSignatures = [...parsed.signatures].sort(
        (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
    );

    await db.transaction().execute(async (trx) => {
        for (const item of orderedSignatures) {
            const lockedForm = await FormRepository.getFormAuthStatusForUpdate(item.proposalId, trx);
            if (lockedForm.auth_status !== "pending_dbm") {
                throw new Error("One or more proposals changed status before signing completed. Please retry.");
            }

            if (!scopedProposalIds.has(lockedForm.id)) {
                throw new Error("One or more proposals no longer belongs to the signed scope.");
            }

            const workflow = getWorkflow(lockedForm.type);
            if (!canSign(lockedForm.auth_status ?? "", session.user.access_level, session.user.workflow_role ?? "", "dbm", workflow)) {
                throw new Error("You are not authorized to reject one or more proposals.");
            }

            const rejectStatus = getNextStatus(lockedForm.auth_status ?? "", workflow, "reject");
            if (rejectStatus !== "rejected") {
                throw new Error("One or more proposals cannot be rejected at this stage.");
            }

            const expectedSignaturePayload = buildSignaturePayload({
                entity_id: lockedForm.entity_id,
                user_id: session.user.id,
                event_type: "REJECT_FORM",
                table_name: "project_proposals",
                record_id: item.proposalId,
                payload: item.payload,
                changed_at: new Date(item.changedAt),
            });

            if (
                item.payload.from_status !== (lockedForm.auth_status ?? "") ||
                item.payload.to_status !== rejectStatus ||
                item.signaturePayload !== expectedSignaturePayload
            ) {
                throw new Error("Signature payload mismatch. Please retry.");
            }

            const signatureStillValid = await verifySignature(
                item.signaturePayload,
                item.signature,
                key.public_key,
            );

            if (!signatureStillValid) {
                throw new Error("Invalid signature.");
            }

            const existingSignature = await KeyRepository.getCurrentCycleSignatoryByTargetAndUserId(
                "forms",
                item.proposalId,
                session.user.id,
                trx,
                item.proposalId,
            );

            if (existingSignature) {
                throw new Error("You have already signed one or more proposals in this batch.");
            }

            await KeyRepository.createSignatoryWithExecutor({
                target_table: "forms",
                target_record_id: item.proposalId,
                source_record_id: item.proposalId,
                user_id: session.user.id,
                role: "dbm",
                event_type: "REJECT_FORM",
                key_id: parsed.keyId,
                public_key_snapshot: key.public_key,
                signature: item.signature,
                signature_payload: item.signaturePayload,
                form_state_hash: item.payload.form_state_hash,
                from_status: lockedForm.auth_status ?? "",
                to_status: rejectStatus,
                remarks: item.payload.remarks ?? null,
                signer_workflow_role: session.user.workflow_role ?? null,
                signer_access_level: session.user.access_level,
                signer_entity_id: session.user.entity_id ?? null,
                signer_is_admin: session.user.is_admin === true,
                created_at: new Date(item.changedAt),
            }, trx);

            await FormRepository.updateFormAuthStatusWithExecutor(item.proposalId, rejectStatus, trx);
            await PapRepository.updatePapProjectStatusForFormWithExecutor(trx, item.proposalId, "rejected");
            await ProposalRepository.rejectProposalAllocationsWithExecutor(
                trx,
                item.proposalId,
                session.user.id,
            );

            await AuditRepository.createLogWithExecutor(trx, {
                entity_id: lockedForm.entity_id,
                user_id: session.user.id,
                event_type: "REJECT_FORM",
                table_name: "project_proposals",
                record_id: item.proposalId,
                payload: item.payload,
                changed_at: new Date(item.changedAt),
                public_key_snapshot: key.public_key,
                signature: item.signature,
            }, item.signaturePayload);
        }
    });

    revalidatePath("/dbm/proposals");
    return { rejectedCount: orderedSignatures.length };
}
