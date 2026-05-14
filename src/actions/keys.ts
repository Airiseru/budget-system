'use server'

import bcrypt from 'bcrypt'
import { createEntityRepository, createKeyRepository, createFormRepository, createAuditRepository, createBudgetSettingsRepository, createBudgetAllocationRepository } from '../db/factory'
import { db } from '../db/postgres/database'
import { sessionDetails, sessionWithEntity } from './auth'
import { redirect } from 'next/navigation'
import { verifySignature } from '../lib/crypto'
import { getWorkflow, canSign, getNextStatus } from '../lib/workflows'
import { logUserKeyCreation, logUserKeyRevoke } from './audit'
import { FormSignaturePayload } from '../types/audit'
import { sha256 } from '../lib/audit-hash'
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
const budgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const budgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')

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

function getSignatoryTarget(formType: string, formId: string, fiscalYear: number | null) {
    if ((formType === 'nep' || formType === 'gaa') && fiscalYear !== null) {
        return {
            targetTable: 'budget_cycles' as const,
            targetRecordId: String(fiscalYear),
        }
    }

    return {
        targetTable: 'forms' as const,
        targetRecordId: formId,
    }
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
    
        // Get form's current status
        const form = await formRepository.getFormAuthStatus(formId)
        const formRecord = ['nep', 'gaa'].includes(form.type)
            ? await formRepository.getFormById(formId)
            : null
        const fiscalYear = formRecord?.fiscal_year ?? await getFormFiscalYear(tableName, formId)
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
            const lockedForm = await formRepository.getFormAuthStatusForUpdate(formId, trx)

            if (!canSign(lockedForm.auth_status ?? '', session.user.access_level, session.user.workflow_role ?? '', signatoryRole, workflow)) {
                throw new Error('You are not authorized to sign at this stage')
            }

            const existingCurrentCycleSignature =
                await keyRepository.getCurrentCycleSignatoryByTargetAndUserId(
                    signatoryTarget.targetTable,
                    signatoryTarget.targetRecordId,
                    session.user.id,
                    trx,
                    formId
                )

            if (existingCurrentCycleSignature) {
                throw new Error('You have already signed this document')
            }

            const createdSignatory = await keyRepository.createSignatoryWithExecutor({
                target_table: signatoryTarget.targetTable,
                target_record_id: signatoryTarget.targetRecordId,
                user_id: session.user.id,
                role: signatoryRole,
                event_type: 'SIGN',
                key_id: keyId,
                public_key_snapshot: key.public_key,
                signature,
                signature_payload: stringSignaturePayload,
                form_state_hash: (payload as FormSignaturePayload).form_state_hash as string ?? '',
                from_status: lockedForm.auth_status ?? '',
                to_status: getNextStatus(lockedForm.auth_status ?? '', workflow, 'approve') ?? '',
                remarks: typeof (payload as FormSignaturePayload).remarks === 'string'
                    ? (payload as FormSignaturePayload).remarks ?? null
                    : null,
                signer_workflow_role: session.user.workflow_role ?? null,
                signer_access_level: session.user.access_level,
                signer_entity_id: session.user.entity_id ?? null,
                signer_is_admin: session.user.is_admin === true,
                created_at: changedAt
            }, trx)

            const nextStatus = getNextStatus(lockedForm.auth_status ?? '', workflow, 'approve') ?? ''
            await formRepository.updateFormAuthStatusWithExecutor(formId, nextStatus, trx)

            await auditRepository.createLogWithExecutor(trx, {
                entity_id: lockedForm.entity_id,
                user_id: session.user.id,
                event_type: 'SIGN',
                table_name: tableName,
                record_id: formId,
                payload: {
                    from_status: lockedForm.auth_status ?? '',
                    to_status: nextStatus,
                    form_state_hash: (payload as FormSignaturePayload).form_state_hash as string ?? '',
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

            if (!canSign(lockedForm.auth_status ?? '', session.user.access_level, session.user.workflow_role ?? "", signatoryRole, workflow)) {
                throw new Error('You are not authorized to reject at this stage')
            }

            const rejectStatus = getNextStatus(lockedForm.auth_status ?? '', workflow, 'reject')
            if (!rejectStatus) {
                throw new Error('This form cannot be rejected at this stage')
            }

            await keyRepository.createSignatoryWithExecutor({
                target_table: signatoryTarget.targetTable,
                target_record_id: signatoryTarget.targetRecordId,
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

    const cryptoValid = await verifySignature(
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
