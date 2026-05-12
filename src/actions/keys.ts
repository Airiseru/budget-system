'use server'

import bcrypt from 'bcrypt'
import { createEntityRepository, createKeyRepository, createFormRepository, createAuditRepository, createBudgetSettingsRepository, createBudgetAllocationRepository } from '../db/factory'
import { sessionDetails, sessionWithEntity } from './auth'
import { redirect } from 'next/navigation'
import { verifySignature } from '../lib/crypto'
import { getWorkflow, canSign, getNextStatus } from '../lib/workflows'
import { logUserKeyCreation, logUserKeyRevoke, logFormSignatories } from './audit'
import { FormSignaturePayload } from '../types/audit'
import { sha256, buildSignaturePayload } from '../lib/audit-hash'
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

async function advanceAllocationPhaseAfterApproval(formType: string, fiscalYear: number, changedBy: string) {
    if (formType === 'nep') {
        await budgetAllocationRepository.updateAllocationStatusForYear(
            fiscalYear,
            ['dbm_approved'],
            'nep_approved'
        )
        await budgetSettingsRepository.editBudgetCycle(
            fiscalYear,
            'active',
            'legislative_deliberation',
            changedBy
        )
        await budgetAllocationRepository.seedAllocationPhaseDefaults(fiscalYear, 'legislative_deliberation')
    }

    if (formType === 'gaa') {
        await budgetAllocationRepository.updateAllocationStatusForYear(
            fiscalYear,
            ['nep_approved'],
            'gaa_approved'
        )
        await budgetSettingsRepository.editBudgetCycle(
            fiscalYear,
            'locked',
            'enacted_gaa',
            changedBy
        )
    }
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
    
        // Get correct workflow for form type
        const workflow = getWorkflow(form.type)
    
        if (!canSign(form.auth_status ?? '', session.user.access_level, session.user.workflow_role ?? '', signatoryRole, workflow)) {
            throw new Error('You are not authorized to sign at this stage')
        }
    
        // Store signature
        const signatory = await keyRepository.createSignatory({
            form_id: formId,
            user_id: session.user.id,
            role: signatoryRole,
            key_id: keyId,
            public_key_snapshot: publicKeySnapshot,
            signature,
            created_at: changedAt
        })
    
        // Update form status
        const nextStatus = getNextStatus(form.auth_status ?? '', workflow, 'approve') ?? ''
        await formRepository.updateFormAuthStatus(formId, nextStatus)

        const stringSignaturePayload = typeof signaturePayload === 'string' ? signaturePayload : canonicalStringify(signaturePayload)

        // Log signature
        const logResult = await logFormSignatories(
            session.user.id,
            form.entity_id,
            tableName,
            formId,
            'SIGN',
            (payload as FormSignaturePayload)?.from_status as string ?? '',
            (payload as FormSignaturePayload).to_status as string ?? '',
            (payload as FormSignaturePayload).form_state_hash as string ?? '',
            changedAt,
            signature,
            key.public_key,
            stringSignaturePayload
        )
    
        if (!logResult.success) throw new Error('Failed to log signature')

        if (fiscalYear !== null && nextStatus === 'approved' && isAllocationSignoffForm) {
            await advanceAllocationPhaseAfterApproval(form.type, fiscalYear, session.user.id)
        }

        return signatory
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

        const form = await formRepository.getFormAuthStatus(formId)
        const fiscalYear = await getFormFiscalYear(tableName, formId)
        const canBypassClosedCycle =
            allowClosedCycleAction &&
            session.user.role === 'dbm' &&
            session.user.workflow_role === 'dbm' &&
            fiscalYear !== null &&
            await canDbmActOnFormForFiscalYear(fiscalYear)

        if (
            fiscalYear !== null &&
            !canBypassClosedCycle &&
            !(await isBudgetPrepActiveForYear(fiscalYear))
        ) {
            throw new Error(getBudgetPrepClosedError(fiscalYear))
        }
        const workflow = getWorkflow(form.type)

        if (!canSign(form.auth_status ?? '', session.user.access_level, session.user.workflow_role ?? "", signatoryRole, workflow)) {
            throw new Error('You are not authorized to reject at this stage')
        }

        const rejectStatus = getNextStatus(form.auth_status ?? '', workflow, 'reject')
        if (!rejectStatus) {
            throw new Error('This form cannot be rejected at this stage')
        }

        await formRepository.updateFormAuthStatus(formId, rejectStatus)

        const stringSignaturePayload = typeof signaturePayload === 'string' ? signaturePayload : canonicalStringify(signaturePayload)

        const logResult = await logFormSignatories(
            session.user.id,
            form.entity_id,
            tableName,
            formId,
            'REJECT_FORM',
            (payload as FormSignaturePayload)?.from_status as string ?? '',
            (payload as FormSignaturePayload).to_status as string ?? '',
            (payload as FormSignaturePayload).form_state_hash as string ?? '',
            changedAt,
            signature,
            key.public_key,
            stringSignaturePayload,
            typeof payload.remarks === 'string' ? payload.remarks : undefined
        )

        if (!logResult.success) throw new Error('Failed to log rejection')

        return { success: true }
    } catch (error) {
        console.error(`Failed to verify and reject signature:`, error)
        throw new Error('Failed to reject form')
    }
}

export async function verifyFormSignature(entityId: string, formId: string, tableName: string, signatoryId: string, formData: object | string) {
    const signatory = await keyRepository.getSignatoryWithKey(signatoryId)
    if (!signatory) throw new Error('Invalid signatory')

    const formPayload = await auditRepository.getPayloadOfFormSignEvent(signatory.user_id, entityId, tableName, formId)

    if (!formPayload) {
        return { isValid: false, cryptoValid: false, keyValidAtSigning: false, keyNotExpiredAtSigning: false, reason: "Form signature not found." }
    }

    if (formPayload === "Form not signed by user") {
        return { isValid: false, cryptoValid: false, keyValidAtSigning: false, keyNotExpiredAtSigning: false, reason: "Form has not been officially signed by respective officer." }
    }
    else if (formPayload === "Multiple signatures of user found for form") {
        return { isValid: false, cryptoValid: false, keyValidAtSigning: false, keyNotExpiredAtSigning: false, reason: "Respective officer has signed multiple times." }
    }

    const cleanFormData = cleanDataBasedOnTable(tableName, formData)
    const form_state_hash = sha256(canonicalStringify(cleanFormData))

    const formIntegrity = await auditRepository.verifyFormIntegrity(tableName, formId)
    console.log(`formIntegrity:`, formIntegrity)

    if ((formPayload as { from_status: string; to_status: string; form_state_hash: string; }).form_state_hash !== form_state_hash) {
        return { isValid: false, cryptoValid: false, keyValidAtSigning: false, keyNotExpiredAtSigning: false, reason: "Respective officer has signed the form but contains different data from current form." }
    }

    let signaturePayload = ''

    if (typeof formData === 'string') {
        signaturePayload = formData
    } else {
        signaturePayload = buildSignaturePayload({
            entity_id: entityId,
            user_id: signatory.user_id,
            event_type: 'SIGN',
            table_name: tableName,
            record_id: formId,
            payload: {
                from_status: (formPayload as FormSignaturePayload).from_status,
                to_status: (formPayload as FormSignaturePayload).to_status,
                form_state_hash: form_state_hash,
            },
            changed_at: signatory.created_at
        })
    }

    const cryptoValid = await verifySignature(
        signaturePayload,
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
