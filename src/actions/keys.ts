'use server'

import bcrypt from 'bcrypt'
import { createEntityRepository, createKeyRepository, createFormRepository, createAuditRepository, createBudgetSettingsRepository, createBudgetAllocationRepository, createPapRepository } from '../db/factory'
import { db } from '../db/postgres/database'
import { sessionDetails, sessionWithEntity } from './auth'
import { redirect } from 'next/navigation'
import { verifySignature } from '../lib/crypto'
import { getWorkflow, canSign, getNextStatus } from '../lib/workflows'
import { logUserKeyCreation, logUserKeyRevoke } from './audit'
import { FormSignaturePayload } from '../types/audit'
import { buildSignaturePayload, sha256 } from '../lib/audit-hash'
import { canonicalStringify } from '../lib/canonical'
import { cleanDataBasedOnTable } from '../lib/validations'
import { createProposalRepository, createRetireeRepository, createStaffingRepository } from '../db/factory'
import {
    getBudgetPrepClosedError,
    getActiveBudgetPrepCycle,
    isBudgetPrepActiveForYear,
} from '../lib/budget-cycle'

const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
const keyRepository = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')
const formRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const auditRepository = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')
const staffingRepository = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')
const retireeRepository = createRetireeRepository(process.env.DATABASE_TYPE || 'postgres')
const proposalRepository = createProposalRepository(process.env.DATABASE_TYPE || 'postgres')
const papRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')
const budgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const budgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')

type SignatureEventType = 'SIGN' | 'APPROVE_FORM' | 'REJECT_FORM'

function getApprovalSignatureEventType(tableName: string, signatoryRole: string): 'SIGN' | 'APPROVE_FORM' {
    if (tableName !== 'budget_allocations' && signatoryRole === 'dbm') {
        return 'APPROVE_FORM'
    }

    return 'SIGN'
}

async function canDbmActOnFormForFiscalYear(fiscalYear: number) {
    const activeCycle = await getActiveBudgetPrepCycle()
    return (
        activeCycle?.fiscal_year === fiscalYear &&
        (activeCycle.current_phase === 'preparation' ||
            activeCycle.current_phase === 'dbm_review')
    )
}

async function validateAllocationSignoffPhase(formType: string, fiscalYear: number) {
    const activeCycle = await getActiveBudgetPrepCycle()
    if (!activeCycle || activeCycle.fiscal_year !== fiscalYear) {
        throw new Error('This allocation sign-off is not available outside the active fiscal year.')
    }

    if (formType === 'nep' && activeCycle.current_phase !== 'presidential_approval') {
        throw new Error('NEP sign-off is only available during the presidential approval phase.')
    }

    if (formType === 'gaa' && activeCycle.current_phase !== 'legislative_deliberation') {
        throw new Error('GAA sign-off is only available during legislative deliberation.')
    }

    if (activeCycle.current_phase === 'legislative_deliberation') {
        const missingValidityCount = await budgetAllocationRepository.countAllocationsMissingValidityByYear(fiscalYear)
        if (missingValidityCount > 0) {
            throw new Error('All allocations must have a complete validity period before this stage can be signed.')
        }
    }
}

async function assertSignerCanAccessEntity(targetEntityId: string, session: Awaited<ReturnType<typeof sessionWithEntity>>) {
    if (!session) throw new Error('Unauthorized')

    if (session.user.role === 'dbm') {
        return
    }

    const signerEntityId = session.user.entity_id
    if (!signerEntityId) {
        throw new Error('You are not assigned to an entity that can sign this form.')
    }

    const accessibleEntityIds = await entityRepository.getAccessibleEntityIds(signerEntityId)
    if (!accessibleEntityIds.includes(targetEntityId)) {
        throw new Error('You can only sign forms owned by your entity or its child entities.')
    }
}

function getSignatoryTarget(formType: string, formId: string, fiscalYear: number | null) {
    if ((formType === 'nep' || formType === 'gaa') && fiscalYear !== null) {
        return {
            targetTable: 'budget_cycles' as const,
            targetRecordId: String(fiscalYear),
            sourceRecordId: formId,
        }
    }

    return {
        targetTable: 'forms' as const,
        targetRecordId: formId,
        sourceRecordId: formId,
    }
}

function parseAllocationSignoffRecordId(recordId: string): { formType: 'nep' | 'gaa'; fiscalYear: number } | null {
    const match = /^(nep|gaa):(\d{4})$/.exec(recordId)
    if (!match) {
        return null
    }

    const fiscalYear = Number(match[2])
    if (!Number.isFinite(fiscalYear)) {
        return null
    }

    return {
        formType: match[1] as 'nep' | 'gaa',
        fiscalYear,
    }
}

async function buildAuthoritativeFormPayload(params: {
    tableName: string
    formId: string
    formData?: object | string
    fromStatus: string
    toStatus: string
    remarks?: string
}) {
    if (params.tableName === 'budget_allocations') {
        const parsed = parseAllocationSignoffRecordId(params.formId)
        if (!parsed) {
            throw new Error('Invalid allocation sign-off record.')
        }

        const snapshot = await budgetAllocationRepository.getAllocationSignoffSnapshot(
            parsed.fiscalYear,
            parsed.formType
        )

        return {
            from_status: params.fromStatus,
            to_status: params.toStatus,
            form_state_hash: sha256(canonicalStringify(snapshot)),
            ...(typeof params.remarks === 'string' && params.remarks.trim()
                ? { remarks: params.remarks.trim() }
                : {}),
        } satisfies FormSignaturePayload
    }

    if (params.formData === undefined) {
        throw new Error(`Form data is required to prepare a signature payload for ${params.tableName}.`)
    }

    const cleanFormData = cleanDataBasedOnTable(params.tableName, params.formData)
    return {
        from_status: params.fromStatus,
        to_status: params.toStatus,
        form_state_hash: sha256(canonicalStringify(cleanFormData)),
        ...(typeof params.remarks === 'string' && params.remarks.trim()
            ? { remarks: params.remarks.trim() }
            : {}),
    } satisfies FormSignaturePayload
}

async function advanceAllocationPhaseAfterApproval(formType: string, fiscalYear: number, changedBy: string) {
    await db.transaction().execute(async (trx) => {
        if (formType === 'nep') {
            await budgetAllocationRepository.updateAllocationStatusForYearWithExecutor(
                fiscalYear,
                ['dbm_approved'],
                'nep_approved',
                trx
            )
            await budgetSettingsRepository.editBudgetCycleWithExecutor(
                fiscalYear,
                'active',
                'legislative_deliberation',
                changedBy,
                trx
            )
            await budgetAllocationRepository.seedAllocationPhaseDefaultsWithExecutor(
                fiscalYear,
                'legislative_deliberation',
                trx
            )
        }

        if (formType === 'gaa') {
            await budgetAllocationRepository.updateAllocationStatusForYearWithExecutor(
                fiscalYear,
                ['nep_approved'],
                'gaa_approved',
                trx
            )
            await papRepository.finalizeProposedPapStatusesAfterGaaWithExecutor(
                trx,
                fiscalYear
            )
            await budgetSettingsRepository.editBudgetCycleWithExecutor(
                fiscalYear,
                'locked',
                'enacted_gaa',
                changedBy,
                trx
            )
        }
    })
}

async function getFormFiscalYear(tableName: string, formId: string): Promise<number | null> {
    if (tableName === 'staffing_summaries') {
        const form = await staffingRepository.getStaffingWithFormById(formId)
        return form?.fiscal_year ?? null
    }

    if (tableName === 'retirees_list') {
        const form = await retireeRepository.getRetireesFormById(formId)
        return form?.fiscal_year ?? null
    }

    if (tableName === 'project_proposals') {
        const form = await proposalRepository.getProjectProposalById(formId)
        return form?.proposal_year ?? null
    }

    return null
}

export async function prepareSignaturePayload({
    tableName,
    formId,
    formData,
    eventType,
    fromStatus,
    toStatus,
    remarks,
}: {
    tableName: string
    formId: string
    formData?: object | string
    eventType: SignatureEventType
    fromStatus: string
    toStatus: string
    remarks?: string
}) {
    const session = await sessionWithEntity()
    if (!session) redirect('/login')

    const parsedAllocationSignoff =
        tableName === 'budget_allocations'
            ? parseAllocationSignoffRecordId(formId)
            : null
    if (parsedAllocationSignoff && session.user.role !== 'dbm') {
        throw new Error('Only DBM can sign allocation sign-offs.')
    }
    const form = parsedAllocationSignoff
        ? {
            entity_id: session.user.entity_id ?? '',
            type: parsedAllocationSignoff.formType,
        }
        : await formRepository.getFormAuthStatus(formId)
    if (!parsedAllocationSignoff) {
        await assertSignerCanAccessEntity(form.entity_id, session)
    }
    const fiscalYear = parsedAllocationSignoff?.fiscalYear ?? await getFormFiscalYear(tableName, formId)
    const target = getSignatoryTarget(form.type, formId, fiscalYear)
    const payload = await buildAuthoritativeFormPayload({
        tableName,
        formId,
        formData,
        fromStatus,
        toStatus,
        remarks,
    })
    const changedAt = new Date()
    const signaturePayload = buildSignaturePayload({
        entity_id: form.entity_id,
        user_id: session.user.id,
        event_type: eventType,
        table_name: tableName,
        record_id: formId,
        payload,
        changed_at: changedAt,
    })

    return {
        payload,
        signaturePayload,
        changedAt: changedAt.toISOString(),
        targetTable: target.targetTable,
        targetRecordId: target.targetRecordId,
        sourceRecordId: target.sourceRecordId,
    }
}

export async function setSigningPin(pin: string) {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    if (!/^\d{6}$/.test(pin)) throw new Error('PIN must be 6 digits')

    const hash = await bcrypt.hash(pin, 12)
    await entityRepository.updateUser(session.user.id, { signing_pin_hash: hash })
}

export async function verifySigningPin(pin: string): Promise<boolean> {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    const user = await entityRepository.getUserById(session.user.id)

    if (!user?.signing_pin_hash) throw new Error('No PIN set')
    return await bcrypt.compare(pin, user.signing_pin_hash)
}

export async function hasSigningPin(): Promise<boolean> {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    const user = await entityRepository.getUserById(session.user.id)
    return !!user?.signing_pin_hash
}

export async function getUserKeys() {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    // Expire old keys upon request
    await keyRepository.expireOldKeys(session.user.id)
    
    // Get keys
    return await keyRepository.getAllKeysOfUser(session.user.id)
}

export async function registerDeviceKey(
    publicKey: string,
    deviceName: string,
    expiresInDays: number = 365
) {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    const key = await keyRepository.createUserKey({
        user_id: session.user.id,
        public_key: publicKey,
        device_name: deviceName,
        status: 'active',
        expires_at: expiresAt
    })

    // Log key creation
    const logResult = await logUserKeyCreation(session.user.id, session.user.entity_id, key.id, deviceName, expiresInDays, key.created_at, publicKey)

    if (!logResult.success) throw new Error('Failed to log user key creation')

    return key
}

export async function revokeDeviceKey(keyId: string, signature: string, date: Date, signaturePayload: string) {
    const session = await sessionDetails()
    if (!session) redirect('/login')
    
    const key = await keyRepository.getUserKeyById(keyId)
    if (!key || key.user_id !== session.user.id) throw new Error('Unauthorized')

    const logResult = await logUserKeyRevoke(session.user.id, session.user.entity_id, keyId, date, signature, key.public_key, signaturePayload)

    if (!logResult.success) throw new Error('Failed to log user key revoke. Aborting revocation.')

    await keyRepository.revokeUserKey(keyId)

}

export async function verifyAndSubmitSignature(
    pin: string,
    tableName: string,
    formId: string,
    payload: FormSignaturePayload | Record<string, unknown>,
    keyId: string,
    publicKeySnapshot: string,
    changedAt: Date,
    signatoryRole: string,
    signature: string,
    signaturePayload: Record<string, unknown> | string,
    allowClosedCycleAction: boolean = false
) {
    try {
        const session = await sessionWithEntity()
        if (!session) redirect('/login')
    
        // Verify if PIN is correct
        if (!await verifySigningPin(pin)) throw new Error('Incorrect PIN')
    
        // Verify active key
        const key = await keyRepository.getUserKeyById(keyId)
        if (!key || key.user_id !== session.user.id) throw new Error('Invalid key')
        if (key.status !== 'active') throw new Error('Key is no longer active')
        if (key.expires_at && key.expires_at < new Date()) throw new Error('Key has expired')
        if (publicKeySnapshot !== key.public_key) throw new Error('Public key snapshot mismatch')
    
        const parsedAllocationSignoff =
            tableName === 'budget_allocations'
                ? parseAllocationSignoffRecordId(formId)
                : null
        if (parsedAllocationSignoff && session.user.role !== 'dbm') {
            throw new Error('Only DBM can sign allocation sign-offs.')
        }
        const form = parsedAllocationSignoff
            ? {
                auth_status: 'pending_dbm',
                entity_id: session.user.entity_id ?? '',
                type: parsedAllocationSignoff.formType,
            }
            : await formRepository.getFormAuthStatus(formId)
        const fiscalYear = parsedAllocationSignoff?.fiscalYear ?? await getFormFiscalYear(tableName, formId)
        const canBypassClosedCycle =
            allowClosedCycleAction &&
            session.user.role === 'dbm' &&
            session.user.workflow_role === 'dbm' &&
            fiscalYear !== null &&
            await canDbmActOnFormForFiscalYear(fiscalYear)
        const signatoryTarget = getSignatoryTarget(form.type, formId, fiscalYear)

        const isAllocationSignoffForm = ['nep', 'gaa'].includes(form.type)

        if (fiscalYear !== null && isAllocationSignoffForm) {
            await validateAllocationSignoffPhase(form.type, fiscalYear)
        } else if (
            fiscalYear !== null &&
            !canBypassClosedCycle &&
            !(await isBudgetPrepActiveForYear(fiscalYear))
        ) {
            throw new Error(getBudgetPrepClosedError(fiscalYear))
        }
    
        const stringSignaturePayload = typeof signaturePayload === 'string' ? signaturePayload : canonicalStringify(signaturePayload)
        const workflow = getWorkflow(form.type)

        const transactionResult = await db.transaction().execute(async (trx) => {
            let currentAuthStatus = 'pending_dbm'
            let currentEntityId = session.user.entity_id ?? ''

            if (parsedAllocationSignoff) {
                const lockedCycle = await budgetSettingsRepository.getBudgetCycleByYearForUpdate(
                    parsedAllocationSignoff.fiscalYear,
                    trx
                )

                if (!lockedCycle) {
                    throw new Error('Sign-off target not found')
                }
            } else {
                const lockedForm = await formRepository.getFormAuthStatusForUpdate(formId, trx)
                currentAuthStatus = lockedForm.auth_status ?? ''
                currentEntityId = lockedForm.entity_id
                await assertSignerCanAccessEntity(currentEntityId, session)
            }

            if (!canSign(currentAuthStatus, session.user.access_level, session.user.workflow_role ?? '', signatoryRole, workflow)) {
                throw new Error('You are not authorized to sign at this stage')
            }

            const nextStatus = getNextStatus(currentAuthStatus, workflow, 'approve') ?? ''
            const authoritativePayload = parsedAllocationSignoff
                ? await buildAuthoritativeFormPayload({
                    tableName,
                    formId,
                    fromStatus: currentAuthStatus,
                    toStatus: nextStatus,
                })
                : payload as FormSignaturePayload

            if (
                authoritativePayload.from_status !== currentAuthStatus ||
                authoritativePayload.to_status !== nextStatus ||
                authoritativePayload.form_state_hash !== (payload as FormSignaturePayload).form_state_hash
            ) {
                throw new Error('The signable data changed before signing completed. Please try again.')
            }

            const approvalEventType = getApprovalSignatureEventType(tableName, signatoryRole)
            const expectedSignaturePayload = buildSignaturePayload({
                entity_id: currentEntityId,
                user_id: session.user.id,
                event_type: approvalEventType,
                table_name: tableName,
                record_id: formId,
                payload: authoritativePayload,
                changed_at: changedAt,
            })

            if (stringSignaturePayload !== expectedSignaturePayload) {
                throw new Error('Signature payload mismatch.')
            }

            const signatureStillValid = await verifySignature(
                stringSignaturePayload,
                signature,
                key.public_key,
            )

            if (!signatureStillValid) {
                throw new Error('Invalid signature.')
            }

            const existingCurrentCycleSignature =
                await keyRepository.getCurrentCycleSignatoryByTargetAndUserId(
                    signatoryTarget.targetTable,
                    signatoryTarget.targetRecordId,
                    session.user.id,
                    trx,
                    signatoryTarget.sourceRecordId
                )

            if (existingCurrentCycleSignature) {
                throw new Error('You have already signed this document')
            }

            const createdSignatory = await keyRepository.createSignatoryWithExecutor({
                target_table: signatoryTarget.targetTable,
                target_record_id: signatoryTarget.targetRecordId,
                source_record_id: signatoryTarget.sourceRecordId,
                user_id: session.user.id,
                role: signatoryRole,
                event_type: approvalEventType,
                key_id: keyId,
                public_key_snapshot: key.public_key,
                signature,
                signature_payload: stringSignaturePayload,
                form_state_hash: authoritativePayload.form_state_hash,
                from_status: currentAuthStatus,
                to_status: nextStatus,
                remarks: typeof authoritativePayload.remarks === 'string'
                    ? authoritativePayload.remarks ?? null
                    : null,
                signer_workflow_role: session.user.workflow_role ?? null,
                signer_access_level: session.user.access_level,
                signer_entity_id: session.user.entity_id ?? null,
                signer_is_admin: session.user.is_admin === true,
                created_at: changedAt
            }, trx)

            if (!parsedAllocationSignoff) {
                await formRepository.updateFormAuthStatusWithExecutor(formId, nextStatus, trx)
            }

            if (
                tableName === 'project_proposals' &&
                nextStatus === 'approved'
            ) {
                await proposalRepository.createAllocationsForApprovedProposalWithExecutor(
                    trx,
                    formId,
                    session.user.id
                )
            }

            await auditRepository.createLogWithExecutor(trx, {
                entity_id: currentEntityId,
                user_id: session.user.id,
                event_type: approvalEventType,
                table_name: tableName,
                record_id: formId,
                payload: {
                    from_status: currentAuthStatus,
                    to_status: nextStatus,
                    form_state_hash: authoritativePayload.form_state_hash,
                },
                changed_at: changedAt,
                public_key_snapshot: key.public_key,
                signature,
            }, stringSignaturePayload)

            return {
                signatory: createdSignatory,
                nextStatus,
            }
        })

        if (fiscalYear !== null && transactionResult.nextStatus === 'approved' && isAllocationSignoffForm) {
            await advanceAllocationPhaseAfterApproval(form.type, fiscalYear, session.user.id)
        }

        return transactionResult.signatory
    } catch (error) {
        console.error(`Failed to verify and submit signature:`, error)
        throw new Error('Failed to submit signature')
    }
}

export async function verifyAndRejectSignature(
    pin: string,
    tableName: string,
    formId: string,
    payload: FormSignaturePayload | Record<string, unknown>,
    keyId: string,
    publicKeySnapshot: string,
    changedAt: Date,
    signatoryRole: string,
    signature: string,
    signaturePayload: Record<string, unknown> | string,
    allowClosedCycleAction: boolean = false
) {
    try {
        const session = await sessionWithEntity()
        if (!session) redirect('/login')

        if (!await verifySigningPin(pin)) throw new Error('Incorrect PIN')

        const key = await keyRepository.getUserKeyById(keyId)
        if (!key || key.user_id !== session.user.id) throw new Error('Invalid key')
        if (key.status !== 'active') throw new Error('Key is no longer active')
        if (key.expires_at && key.expires_at < new Date()) throw new Error('Key has expired')
        if (publicKeySnapshot !== key.public_key) throw new Error('Public key snapshot mismatch')

        const form = await formRepository.getFormAuthStatus(formId)
        await assertSignerCanAccessEntity(form.entity_id, session)
        const fiscalYear = await getFormFiscalYear(tableName, formId)
        const canBypassClosedCycle =
            allowClosedCycleAction &&
            session.user.role === 'dbm' &&
            session.user.workflow_role === 'dbm' &&
            fiscalYear !== null &&
            await canDbmActOnFormForFiscalYear(fiscalYear)
        const signatoryTarget = getSignatoryTarget(form.type, formId, fiscalYear)

        if (
            fiscalYear !== null &&
            !canBypassClosedCycle &&
            !(await isBudgetPrepActiveForYear(fiscalYear))
        ) {
            throw new Error(getBudgetPrepClosedError(fiscalYear))
        }
        const stringSignaturePayload = typeof signaturePayload === 'string' ? signaturePayload : canonicalStringify(signaturePayload)
        const workflow = getWorkflow(form.type)

        await db.transaction().execute(async (trx) => {
            const lockedForm = await formRepository.getFormAuthStatusForUpdate(formId, trx)
            await assertSignerCanAccessEntity(lockedForm.entity_id, session)

            if (!canSign(lockedForm.auth_status ?? '', session.user.access_level, session.user.workflow_role ?? "", signatoryRole, workflow)) {
                throw new Error('You are not authorized to reject at this stage')
            }

            const rejectStatus = getNextStatus(lockedForm.auth_status ?? '', workflow, 'reject')
            if (!rejectStatus) {
                throw new Error('This form cannot be rejected at this stage')
            }

            const authoritativePayload = payload as FormSignaturePayload
            const expectedSignaturePayload = buildSignaturePayload({
                entity_id: lockedForm.entity_id,
                user_id: session.user.id,
                event_type: 'REJECT_FORM',
                table_name: tableName,
                record_id: formId,
                payload: authoritativePayload,
                changed_at: changedAt,
            })

            if (
                authoritativePayload.from_status !== (lockedForm.auth_status ?? '') ||
                authoritativePayload.to_status !== rejectStatus ||
                stringSignaturePayload !== expectedSignaturePayload
            ) {
                throw new Error('Signature payload mismatch.')
            }

            const signatureStillValid = await verifySignature(
                stringSignaturePayload,
                signature,
                key.public_key,
            )

            if (!signatureStillValid) {
                throw new Error('Invalid signature.')
            }

            await keyRepository.createSignatoryWithExecutor({
                target_table: signatoryTarget.targetTable,
                target_record_id: signatoryTarget.targetRecordId,
                source_record_id: signatoryTarget.sourceRecordId,
                user_id: session.user.id,
                role: signatoryRole,
                event_type: 'REJECT_FORM',
                key_id: keyId,
                public_key_snapshot: key.public_key,
                signature,
                signature_payload: stringSignaturePayload,
                form_state_hash: (payload as FormSignaturePayload).form_state_hash as string ?? '',
                from_status: lockedForm.auth_status ?? '',
                to_status: rejectStatus,
                remarks: typeof (payload as FormSignaturePayload).remarks === 'string'
                    ? (payload as FormSignaturePayload).remarks ?? null
                    : null,
                signer_workflow_role: session.user.workflow_role ?? null,
                signer_access_level: session.user.access_level,
                signer_entity_id: session.user.entity_id ?? null,
                signer_is_admin: session.user.is_admin === true,
                created_at: changedAt,
            }, trx)

            await formRepository.updateFormAuthStatusWithExecutor(formId, rejectStatus, trx)

            if (
                tableName === 'project_proposals' &&
                rejectStatus === 'rejected'
            ) {
                await papRepository.updatePapProjectStatusForFormWithExecutor(
                    trx,
                    formId,
                    'rejected'
                )
                await proposalRepository.rejectProposalAllocationsWithExecutor(
                    trx,
                    formId,
                    session.user.id
                )
            }

            await auditRepository.createLogWithExecutor(trx, {
                entity_id: lockedForm.entity_id,
                user_id: session.user.id,
                event_type: 'REJECT_FORM',
                table_name: tableName,
                record_id: formId,
                payload: {
                    from_status: lockedForm.auth_status ?? '',
                    to_status: rejectStatus,
                    form_state_hash: (payload as FormSignaturePayload).form_state_hash as string ?? '',
                    ...(typeof payload.remarks === 'string' ? { remarks: payload.remarks } : {}),
                },
                changed_at: changedAt,
                public_key_snapshot: key.public_key,
                signature,
            }, stringSignaturePayload)
        })

        return { success: true }
    } catch (error) {
        console.error(`Failed to verify and reject signature:`, error)
        throw new Error('Failed to reject form')
    }
}

export async function verifyFormSignature(
    signatoryId: string,
    tableName: string,
    formData: object | string
) {
    const signatory = await keyRepository.getSignatoryWithKey(signatoryId)
    if (!signatory) throw new Error('Invalid signatory')
    const cleanFormData = cleanDataBasedOnTable(tableName, formData)
    const form_state_hash = sha256(canonicalStringify(cleanFormData))

    if (signatory.form_state_hash !== form_state_hash) {
        return {
            isValid: false,
            cryptoValid: false,
            keyValidAtSigning: false,
            keyNotExpiredAtSigning: false,
            reason: "Respective officer has signed the form but contains different data from current form."
        }
    }

    const cryptoValidPromise = verifySignature(
        signatory.signature_payload,
        signatory.signature,
        signatory.public_key_snapshot
    )

    const keyValidAtSigning =
        signatory.key_status !== 'revoked' ||
        (signatory.revoked_at !== null && signatory.revoked_at > signatory.created_at)

    const keyNotExpiredAtSigning =
        signatory.expires_at === null ||
        signatory.expires_at > signatory.created_at

    const cryptoValid = await cryptoValidPromise

    console.log("Crypto valid:", cryptoValid)
    console.log("Key valid at signing:", keyValidAtSigning)
    console.log("Key not expired at signing:", keyNotExpiredAtSigning)

    return {
        isValid: cryptoValid && keyValidAtSigning && keyNotExpiredAtSigning,
        cryptoValid,
        keyValidAtSigning,
        keyNotExpiredAtSigning,
    }
}
