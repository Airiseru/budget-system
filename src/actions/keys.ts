'use server'

import bcrypt from 'bcrypt'
import { createEntityRepository, createKeyRepository, createFormRepository } from '../db/factory'
import { requireMinAccessLevel, sessionDetails } from './auth'
import { redirect } from 'next/navigation'
import { verifySignature } from '../lib/crypto'
import { getWorkflow, canSign, getNextStatus } from '../lib/workflows'

const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
const keyRepository = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')
const formRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

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

    return await keyRepository.createUserKey({
        user_id: session.user.id,
        public_key: publicKey,
        device_name: deviceName,
        status: 'active',
        expires_at: expiresAt
    })
}

export async function revokeDeviceKey(keyId: string) {
    const session = await sessionDetails()
    if (!session) redirect('/login')
    
    const key = await keyRepository.getUserKeyById(keyId)
    if (!key || key.user_id !== session.user.id) throw new Error('Unauthorized')

    return await keyRepository.revokeUserKey(keyId)
}

export async function verifyAndSubmitSignature(
    pin: string,
    formId: string,
    keyId: string,
    publicKeySnapshot: string,
    signatoryRole: string,
    signature: string
) {
    const session = await sessionDetails()
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
        signature
    })

    // Update form status
    await formRepository.updateFormAuthStatus(formId, getNextStatus(form.auth_status ?? '', workflow) ?? '')

    return signatory
}

export async function verifyFormSignature(signatoryId: string, formData: object) {
    const signatory = await keyRepository.getSignatoryWithKey(signatoryId)
    if (!signatory) throw new Error('Invalid signatory')
    const cryptoValid = await verifySignature(
        formData,
        signatory.signature,
        signatory.public_key_snapshot
    )

    const keyValidAtSigning =
        signatory.key_status !== 'revoked' ||
        (signatory.revoked_at !== null && signatory.revoked_at > signatory.created_at)

    const keyNotExpiredAtSigning =
        signatory.expires_at === null ||
        signatory.expires_at > signatory.created_at

    return {
        isValid: cryptoValid && keyValidAtSigning && keyNotExpiredAtSigning,
        cryptoValid,
        keyValidAtSigning,
        keyNotExpiredAtSigning,
    }
}