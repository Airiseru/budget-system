"use server"

import { createAuditRepository, createKeyRepository } from "@/src/db/factory"
import { NewAuditLog, SignedLogInput } from "../types/audit"
import { sessionWithEntity } from "./auth"
import { redirect } from 'next/navigation'
import { computeDiff, isDiffEmpty } from "../lib/diff"
import { AuditEventType, SignaturePayload } from "../types/audit"

const AuditRepository = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')
const KeyRepository = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')

async function executeAudit(log: Omit<NewAuditLog, 'hash'>, signingPayload: SignaturePayload | string | null = null) {
    try {
        await AuditRepository.createLog(log, signingPayload)
        console.log(`[AUDIT] Logged ${log.event_type}`)
        return { success: true }
    } catch (error) {
        console.error(`[AUDIT FATAL] Failed to log ${log.event_type}:`, error)
        return { success: false, error: "System logging failed." }
    }
}

async function createSignedLog(
    input: SignedLogInput
) {
    console.log(`CREATE SIGNED LOG INPUT:`, input)
    return await executeAudit({
        entity_id: input.entityId,
        user_id: input.userId,
        event_type: input.eventType,
        table_name: input.tableName,
        record_id: input.recordId,
        payload: input.payload,
        changed_at: input.changedAt,
        public_key_snapshot: input.publicKeySnapshot,
        signature: input.signature
    }, input.signaturePayload)
}

export async function logUserSignUp(userId: string, entityId: string, userData: Record<string, unknown>, date: Date) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'SIGNUP',
        table_name: 'users',
        record_id: userId,
        payload: userData, 
        changed_at: date ? date : new Date()
    })
}

export async function logUserLogin(userId: string, entityId: string) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'LOGIN',
        table_name: null,
        record_id: null,
        payload: null,
        changed_at: new Date()
    })
}

export async function logUserLogout(userId: string, entityId: string) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'LOGOUT',
        table_name: null,
        record_id: null,
        payload: null,
        changed_at: new Date()
    })
}

export async function logSetUserPin(
    userId: string,
    entityId: string
) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'SET_PIN',
        table_name: 'users',
        record_id: userId,
        payload: null,
        changed_at: new Date()
    })
}

export async function logUpdateUserPin(
    userId: string,
    entityId: string
) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'UPDATE_PIN',
        table_name: 'users',
        record_id: userId,
        payload: null,
        changed_at: new Date()
    })
}

export async function logEntity(
    userId: string,
    entityId: string,
    eventType: AuditEventType,
    tableName: string,
    recordId: string,
    payload: Record<string, unknown>,
    date: Date,
    signature: string,
    publicKeySnapshot: string,
    signaturePayload: string
) {
    if (eventType !== 'CREATE_ENTITY' && eventType !== 'EDIT') return { success: false, error: "Invalid event type" }

    return await createSignedLog({
        entityId,
        userId,
        eventType: eventType,
        tableName: tableName,
        recordId: recordId,
        payload: payload,
        changedAt: date,
        publicKeySnapshot,
        signature,
        signaturePayload
    })
}

export async function logUserStatusUpdate(
    userId: string,
    entityId: string,
    eventType: AuditEventType,
    tableName: string,
    recordId: string,
    payload: Record<string, unknown>,
    date: Date,
    signature: string,
    publicKeySnapshot: string,
    signaturePayload: string
) {
    if (eventType !== 'CREATE_ENTITY' && eventType !== 'EDIT') return { success: false, error: "Invalid event type" }

    return await createSignedLog({
        entityId,
        userId,
        eventType: eventType,
        tableName: tableName,
        recordId: recordId,
        payload: payload,
        changedAt: date,
        publicKeySnapshot,
        signature,
        signaturePayload
    })
}

export async function logUserKeyCreation(userId: string, entityId: string, keyId: string, deviceName: string, expiresInDays: number, date: Date, publicKey: string) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'REGISTER_KEY',
        table_name: 'user_keys',
        record_id: keyId,
        payload: {
            device_name: deviceName,
            expires_in_days: expiresInDays,
            public_key: publicKey
        },
        changed_at: date,
    })
}

export async function logUserKeyRevoke(userId: string, entityId: string, keyId: string, date: Date, signature: string, publicKey: string, signaturePayload: string) {
    try {
        // Verify active key
        const key = await KeyRepository.getUserKeyById(keyId)
        if (!key || key.user_id !== userId) throw new Error('Invalid key')
        if (key.status !== 'active') throw new Error('Key is no longer active')
        if (key.expires_at && key.expires_at < new Date()) throw new Error('Key has expired')

        return await createSignedLog({
            entityId,
            userId,
            eventType: 'REVOKE_KEY',
            tableName: 'user_keys',
            recordId: keyId,
            payload: {
                status: 'revoked'
            },
            changedAt: date,
            publicKeySnapshot: key.public_key || publicKey,
            signature,
            signaturePayload
        })
    } catch (error) {
        console.error("Failed to log user key revoke", error)
        return { success: false, error: "Failed to log user key revoke" }
    }
}

export async function logNewForm(
    userId: string,
    entityId: string,
    tableName: string,
    recordId: string,
    formData: Record<string, unknown>,
    date: Date
) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'CREATE_FORM',
        table_name: tableName,
        record_id: recordId,
        payload: formData,
        changed_at: date
    })
}

export async function logSaveFormEdits(
    userId: string,
    entityId: string,
    tableName: string,
    recordId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    date: Date
) {
    const diff = computeDiff(oldData, newData)
    if (isDiffEmpty(diff)) return { success: true }
    console.log(`DIFF: ${JSON.stringify(diff)}`)

    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'EDIT_FORM',
        table_name: tableName,
        record_id: recordId,
        payload: diff,
        changed_at: date
    })
}

export async function logSubmitForm(
    userId: string,
    entityId: string,
    tableName: string,
    recordId: string,
    formData: Record<string, unknown>,
    date: Date
) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'SUBMIT_FORM',
        table_name: tableName,
        record_id: recordId,
        payload: formData,
        changed_at: date
    })
}

export async function logFormSignatories(
    userId: string,
    entityId: string,
    tableName: string,
    recordId: string,
    eventType: AuditEventType,
    oldStatus: string,
    newStatus: string,
    formStateHash: string,
    date: Date,
    signature: string,
    publicKey: string,
    signaturePayload: string,
) {
    if (eventType !== 'SIGN' && eventType !== 'APPROVE_FORM') return { success: false, error: "Invalid event type" }

    try {
        return await createSignedLog({
            entityId: entityId,
            userId: userId,
            eventType: eventType,
            tableName: tableName,
            recordId: recordId,
            payload: {
                from_status: oldStatus,
                to_status: newStatus,
                form_state_hash: formStateHash
            },
            changedAt: date,
            publicKeySnapshot: publicKey,
            signature: signature,
            signaturePayload: signaturePayload
        })
    } catch (error) {
        console.error(`Failed to log form signatories for event type ${eventType}`, error)
        return { success: false, error: "Failed to log form signatories" }
    }
}

export async function getFormIntegrity(tableName: string, recordId: string) {
    return await AuditRepository.verifyFormIntegrity(tableName, recordId)
}