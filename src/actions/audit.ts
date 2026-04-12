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
    return await executeAudit({
        entity_id: input.entityId,
        user_id: input.userId,
        event_type: input.eventType,
        table_name: input.tableName,
        record_id: input.recordId,
        payload: input.payload,
        changed_at: input.changed_at,
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

export async function logUserKeyCreation(userId: string, entityId: string, keyId: string, deviceName: string, expiresInDays: number, date: Date, publicKey: string) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'REGISTER_KEY',
        table_name: 'user_keys',
        record_id: keyId,
        payload: {
            device_name: deviceName,
            expires_in_days: expiresInDays
        },
        changed_at: date,
        public_key_snapshot: publicKey
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
            changed_at: date,
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
        event_type: 'NEW_FORM',
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
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'SAVE_DRAFT',
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
        event_type: 'SUBMIT',
        table_name: tableName,
        record_id: recordId,
        payload: formData,
        changed_at: date
    })
}

