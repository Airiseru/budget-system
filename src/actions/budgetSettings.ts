'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '../db/postgres/database'
import { sessionDetails } from './auth'
import { verifySigningPin } from './keys'
import { createAuditRepository, createBudgetSettingsRepository, createBudgetAllocationRepository, createKeyRepository } from '../db/factory'
import { StartBudgetCycleSchema, EditBudgetCycleSchema, BudgetCycleFormState } from '../lib/validations/budgetSettings'
import { isAdminUser, isDbmUser } from '../lib/user-status'
import { buildSignaturePayload, sha256 } from '../lib/audit-hash'
import { canonicalStringify } from '../lib/canonical'
import { verifySignature } from '../lib/crypto'
import type { BudgetCycle, BudgetCyclePhase } from '../types/budget_settings'
import type { FormSignaturePayload } from '../types/audit'

const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')
const KeyRepository = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')
const AuditRepository = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')

type BudgetCycleSignedAction = 'start_cycle' | 'change_phase'

const BudgetCycleSignatureRequestSchema = z.object({
    action: z.enum(['start_cycle', 'change_phase']),
    fiscal_year: z.coerce.number().int().min(2000).max(9999),
    legal_basis_ref: z.string().trim().max(255).optional(),
    current_phase: z.enum([
        'preparation',
        'dbm_review',
        'presidential_approval',
        'legislative_deliberation',
        'enacted_gaa',
    ]).optional(),
})

const SubmitBudgetCycleSignatureSchema = z.object({
    action: z.enum(['start_cycle', 'change_phase']),
    fiscal_year: z.number().int().min(2000).max(9999),
    legal_basis_ref: z.string().trim().max(255).optional(),
    current_phase: z.enum([
        'preparation',
        'dbm_review',
        'presidential_approval',
        'legislative_deliberation',
        'enacted_gaa',
    ]).optional(),
    pin: z.string().regex(/^\d{6}$/),
    key_id: z.string().uuid(),
    public_key_snapshot: z.string().min(1),
    changed_at: z.string(),
    payload: z.object({
        from_status: z.string(),
        to_status: z.string(),
        form_state_hash: z.string(),
    }),
    signature: z.string().min(1),
    signature_payload: z.string().min(1),
})

async function requireBudgetCycleManager() {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    const isAdmin = isAdminUser(session.user)
    const isDbmApprover = isDbmUser(session.user)

    if (!isAdmin && !isDbmApprover) {
        redirect('/home')
    }

    return session
}

async function requireDbmApproverForBudgetCycleSignature() {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    if (!isDbmUser(session.user) || session.user.workflow_role !== 'dbm' || !session.user.entity_id) {
        throw new Error('Only a DBM approver with an assigned DBM entity can sign budget cycle changes.')
    }

    return session
}

function getBudgetCycleSourceRecordId(params: {
    action: BudgetCycleSignedAction
    fiscalYear: number
    fromStatus: string
    toStatus: string
}) {
    return `budget-cycle:${params.action}:${params.fiscalYear}:${params.fromStatus}->${params.toStatus}`
}

function getBudgetCycleChangeState(params: {
    action: BudgetCycleSignedAction
    fiscalYear: number
    existingCycle: BudgetCycle | null
    nextPhase?: BudgetCyclePhase
    legalBasisRef?: string | null
}) {
    if (params.action === 'start_cycle') {
        return {
            fromStatus: params.existingCycle
                ? `${params.existingCycle.prep_status}:${params.existingCycle.current_phase}`
                : 'none',
            toStatus: 'active:preparation',
            state: {
                action: params.action,
                fiscal_year: params.fiscalYear,
                from: params.existingCycle
                    ? {
                        prep_status: params.existingCycle.prep_status,
                        current_phase: params.existingCycle.current_phase,
                    }
                    : null,
                to: {
                    prep_status: 'active',
                    current_phase: 'preparation',
                    legal_basis_ref: params.legalBasisRef ?? null,
                },
            },
        }
    }

    if (!params.existingCycle) {
        throw new Error(`Fiscal year ${params.fiscalYear} does not exist.`)
    }

    if (!params.nextPhase) {
        throw new Error('Target phase is required.')
    }

    return {
        fromStatus: `${params.existingCycle.prep_status}:${params.existingCycle.current_phase}`,
        toStatus: `${params.nextPhase === 'enacted_gaa' ? 'locked' : 'active'}:${params.nextPhase}`,
        state: {
            action: params.action,
            fiscal_year: params.fiscalYear,
            from: {
                prep_status: params.existingCycle.prep_status,
                current_phase: params.existingCycle.current_phase,
            },
            to: {
                prep_status: params.nextPhase === 'enacted_gaa' ? 'locked' : 'active',
                current_phase: params.nextPhase,
                legal_basis_ref: params.legalBasisRef ?? params.existingCycle.legal_basis_ref ?? null,
            },
        },
    }
}

async function buildBudgetCycleSignaturePayload(params: {
    action: BudgetCycleSignedAction
    fiscalYear: number
    nextPhase?: BudgetCyclePhase
    legalBasisRef?: string | null
    changedAt: Date
    userId: string
    entityId: string
    executor?: typeof db
    lockForUpdate?: boolean
}) {
    const executor = params.executor ?? db
    let cycleQuery = executor
        .selectFrom('budget_cycles')
        .selectAll()
        .where('fiscal_year', '=', params.fiscalYear)

    if (params.lockForUpdate) {
        cycleQuery = cycleQuery.forUpdate()
    }

    const existingCycle = await cycleQuery
        .executeTakeFirst() ?? null
    const change = getBudgetCycleChangeState({
        action: params.action,
        fiscalYear: params.fiscalYear,
        existingCycle,
        nextPhase: params.nextPhase,
        legalBasisRef: params.legalBasisRef,
    })
    const payload = {
        from_status: change.fromStatus,
        to_status: change.toStatus,
        form_state_hash: sha256(canonicalStringify(change.state)),
    } satisfies FormSignaturePayload
    const signaturePayload = buildSignaturePayload({
        entity_id: params.entityId,
        user_id: params.userId,
        event_type: 'SIGN',
        table_name: 'budget_cycles',
        record_id: String(params.fiscalYear),
        payload,
        changed_at: params.changedAt,
    })

    return {
        payload,
        signaturePayload,
        sourceRecordId: getBudgetCycleSourceRecordId({
            action: params.action,
            fiscalYear: params.fiscalYear,
            fromStatus: change.fromStatus,
            toStatus: change.toStatus,
        }),
    }
}

export async function loadBudgetCycles() {
    await requireBudgetCycleManager()

    const [cycles, activeCycle] = await Promise.all([
        BudgetSettingsRepository.listBudgetCycles(),
        BudgetSettingsRepository.getActiveBudgetCycle(),
    ])

    return { cycles, activeCycle }
}

export async function loadBudgetCycle(fiscalYear: number) {
    await requireBudgetCycleManager()
    return await BudgetSettingsRepository.getBudgetCycleByYear(fiscalYear)
}

export async function startBudgetCycleAction(
    state: BudgetCycleFormState,
    formData: FormData
): Promise<BudgetCycleFormState> {
    await requireBudgetCycleManager()

    const fiscal_year = formData.get('fiscal_year') as string
    const legal_basis_ref = formData.get('legal_basis_ref') as string
    const values = {
        fiscal_year,
        legal_basis_ref,
    }

    const parsed = StartBudgetCycleSchema.safeParse(values)
    if (!parsed.success) {
        return {
            ...z.flattenError(parsed.error),
            values,
        }
    }

    return {
        formErrors: ['Starting a budget cycle requires a DBM approver digital signature. Use the signed start control.'],
        values,
    }
}

export async function lockActiveBudgetCycleAction(
    _state: BudgetCycleFormState
): Promise<BudgetCycleFormState> {
    void _state
    await requireBudgetCycleManager()

    return {
        formErrors: ['Locking or stopping a budget cycle requires a DBM approver digital signature. Use the signed phase control.'],
    }
}

export async function editBudgetCycleAction(
    state: BudgetCycleFormState,
    formData: FormData
): Promise<BudgetCycleFormState> {
    await requireBudgetCycleManager()

    const values = {
        fiscal_year: String(formData.get('fiscal_year') ?? ''),
        prep_status: String(formData.get('prep_status') ?? ''),
        current_phase: String(formData.get('current_phase') ?? ''),
        legal_basis_ref: String(formData.get('legal_basis_ref') ?? ''),
    }

    const parsed = EditBudgetCycleSchema.safeParse(values)
    if (!parsed.success) {
        return {
            ...z.flattenError(parsed.error),
            values,
        }
    }

    return {
        formErrors: ['Changing the budget cycle phase requires a DBM approver digital signature. Use the signed phase control.'],
        values,
    }
}

export async function prepareBudgetCycleSignaturePayload(input: {
    action: BudgetCycleSignedAction
    fiscal_year: number
    current_phase?: BudgetCyclePhase
    legal_basis_ref?: string
}) {
    const session = await requireDbmApproverForBudgetCycleSignature()
    const parsed = BudgetCycleSignatureRequestSchema.parse(input)
    const changedAt = new Date()

    return await buildBudgetCycleSignaturePayload({
        action: parsed.action,
        fiscalYear: parsed.fiscal_year,
        nextPhase: parsed.current_phase,
        legalBasisRef: parsed.legal_basis_ref || null,
        changedAt,
        userId: session.user.id,
        entityId: session.user.entity_id!,
    }).then((prepared) => ({
        payload: prepared.payload,
        signaturePayload: prepared.signaturePayload,
        changedAt: changedAt.toISOString(),
    }))
}

export async function submitSignedBudgetCycleChange(input: {
    action: BudgetCycleSignedAction
    fiscal_year: number
    current_phase?: BudgetCyclePhase
    legal_basis_ref?: string
    pin: string
    key_id: string
    public_key_snapshot: string
    changed_at: string
    payload: FormSignaturePayload
    signature: string
    signature_payload: string
}) {
    const session = await requireDbmApproverForBudgetCycleSignature()
    const parsed = SubmitBudgetCycleSignatureSchema.parse(input)
    const changedAt = new Date(parsed.changed_at)

    if (!Number.isFinite(changedAt.getTime())) {
        throw new Error('Invalid signature timestamp.')
    }

    if (!(await verifySigningPin(parsed.pin))) {
        throw new Error('Incorrect PIN.')
    }

    const key = await KeyRepository.getUserKeyById(parsed.key_id)
    if (!key || key.user_id !== session.user.id) throw new Error('Invalid key.')
    if (key.status !== 'active') throw new Error('Key is no longer active.')
    if (key.expires_at && key.expires_at < new Date()) throw new Error('Key has expired.')
    if (parsed.public_key_snapshot !== key.public_key) throw new Error('Public key snapshot mismatch.')

    await db.transaction().execute(async (trx) => {
        const authoritative = await buildBudgetCycleSignaturePayload({
            action: parsed.action,
            fiscalYear: parsed.fiscal_year,
            nextPhase: parsed.current_phase,
            legalBasisRef: parsed.legal_basis_ref || null,
            changedAt,
            userId: session.user.id,
            entityId: session.user.entity_id!,
            executor: trx,
            lockForUpdate: true,
        })

        if (
            authoritative.payload.from_status !== parsed.payload.from_status ||
            authoritative.payload.to_status !== parsed.payload.to_status ||
            authoritative.payload.form_state_hash !== parsed.payload.form_state_hash
        ) {
            throw new Error('The budget cycle changed before signing completed. Please retry.')
        }

        if (authoritative.signaturePayload !== parsed.signature_payload) {
            throw new Error('Signature payload mismatch.')
        }

        const signatureValid = await verifySignature(
            parsed.signature_payload,
            parsed.signature,
            key.public_key,
        )
        if (!signatureValid) throw new Error('Invalid signature.')

        const existingSignature = await KeyRepository.getCurrentCycleSignatoryByTargetAndUserId(
            'budget_cycles',
            String(parsed.fiscal_year),
            session.user.id,
            trx,
            authoritative.sourceRecordId,
        )
        if (existingSignature) {
            throw new Error('You have already signed this budget cycle change.')
        }

        await KeyRepository.createSignatoryWithExecutor({
            target_table: 'budget_cycles',
            target_record_id: String(parsed.fiscal_year),
            source_record_id: authoritative.sourceRecordId,
            user_id: session.user.id,
            role: 'dbm',
            event_type: 'SIGN',
            key_id: key.id,
            public_key_snapshot: key.public_key,
            signature: parsed.signature,
            signature_payload: parsed.signature_payload,
            form_state_hash: authoritative.payload.form_state_hash,
            from_status: authoritative.payload.from_status,
            to_status: authoritative.payload.to_status,
            remarks: null,
            signer_workflow_role: session.user.workflow_role ?? null,
            signer_access_level: session.user.access_level,
            signer_entity_id: session.user.entity_id ?? null,
            signer_is_admin: session.user.is_admin === true,
            created_at: changedAt,
        }, trx)

        if (parsed.action === 'start_cycle') {
            await BudgetSettingsRepository.startBudgetCycleWithExecutor(
                parsed.fiscal_year,
                session.user.id,
                trx,
                parsed.legal_basis_ref || null,
            )
        } else {
            await BudgetSettingsRepository.editBudgetCycleWithExecutor(
                parsed.fiscal_year,
                parsed.current_phase === 'enacted_gaa' ? 'locked' : 'active',
                parsed.current_phase!,
                session.user.id,
                trx,
                parsed.legal_basis_ref || null,
            )

            if (
                parsed.current_phase === 'presidential_approval' ||
                parsed.current_phase === 'legislative_deliberation'
            ) {
                await BudgetAllocationRepository.seedAllocationPhaseDefaultsWithExecutor(
                    parsed.fiscal_year,
                    parsed.current_phase,
                    trx,
                )
            }
        }

        await AuditRepository.createLogWithExecutor(trx, {
            entity_id: session.user.entity_id!,
            user_id: session.user.id,
            event_type: 'SIGN',
            table_name: 'budget_cycles',
            record_id: String(parsed.fiscal_year),
            payload: {
                from_status: authoritative.payload.from_status,
                to_status: authoritative.payload.to_status,
                form_state_hash: authoritative.payload.form_state_hash,
            },
            changed_at: changedAt,
            public_key_snapshot: key.public_key,
            signature: parsed.signature,
        }, parsed.signature_payload)
    })

    revalidatePath('/dbm/settings/cycles')
    return { success: true }
}
