'use server'

import bcrypt from 'bcrypt'
import { createEntityRepository, createKeyRepository, createFormRepository, createAuditRepository } from '../db/factory'
import { requireMinAccessLevel, sessionDetails, sessionWithEntity } from './auth'
import { redirect } from 'next/navigation'
import { verifySignature } from '../lib/crypto'
import { getWorkflow, canSign, getNextStatus } from '../lib/workflows'
import { logUserKeyCreation, logUserKeyRevoke, logFormSignatories } from './audit'
import { FormSignaturePayload } from '../types/audit'
import { sha256, buildSignaturePayload } from '../lib/audit-hash'
import { canonicalStringify } from '../lib/canonical'
import { cleanDataBasedOnTable } from '../lib/validations'

const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
const keyRepository = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')
const formRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const auditRepository = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')

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
    payload: FormSignaturePayload | Record<string, any>,
    keyId: string,
    publicKeySnapshot: string,
    changedAt: Date,
    signatoryRole: string,
    signature: string,
    signaturePayload: Record<string, any> | string
) {
    try {
        const session = await sessionWithEntity()
        if (!session) redirect('/login')
    
        const validAccess = await requireMinAccessLevel('encode', false) as boolean
    
        if (!validAccess) throw new Error('Unauthorized')
    
        // Verify if PIN is correct
        if (!await verifySigningPin(pin)) throw new Error('Incorrect PIN')
    
        // Verify active key
        const key = await keyRepository.getUserKeyById(keyId)
        if (!key || key.user_id !== session.user.id) throw new Error('Invalid key')
        if (key.status !== 'active') throw new Error('Key is no longer active')
        if (key.expires_at && key.expires_at < new Date()) throw new Error('Key has expired')
    
        // Get form's current status
        const form = await formRepository.getFormAuthStatus(formId)
    
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
        await formRepository.updateFormAuthStatus(formId, getNextStatus(form.auth_status ?? '', workflow) ?? '')

        console.log(`signature payload in verifyAndSubmitSignature:`, signaturePayload)
        const stringSignaturePayload = typeof signaturePayload === 'string' ? signaturePayload : canonicalStringify(signaturePayload)

        // Log signature
        const logResult = await logFormSignatories(
            session.user.id,
            session.user.entity_id,
            tableName,
            formId,
            'SIGN',
            payload?.from_status ?? '',
            payload.to_status ?? '',
            payload.form_state_hash ?? '',
            changedAt,
            signature,
            key.public_key,
            stringSignaturePayload
        )
    
        if (!logResult.success) throw new Error('Failed to log signature')
    
        return signatory
    } catch (error) {
        console.error(`Failed to verify and submit signature:`, error)
        throw new Error('Failed to submit signature')
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
            changed_at: signatory.created_at.toISOString()
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