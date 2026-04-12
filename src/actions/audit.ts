"use server"

import { createAuditRepository, createKeyRepository } from "@/src/db/factory"
import { NewAuditLog } from "../types/audit"
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

export async function logUserSignUp(userId: string, entityId: string) {
    return await executeAudit({
        entity_id: entityId,
        user_id: userId,
        event_type: 'SIGNUP',
        table_name: 'users',
        record_id: userId,
        payload: { action: "signup" }, 
        changed_at: new Date()
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

        return await executeAudit({
            entity_id: entityId,
            user_id: userId,
            event_type: 'REVOKE_KEY',
            table_name: 'user_keys',
            record_id: keyId,
            payload: {
                status: 'revoked'
            },
            changed_at: date,
            public_key_snapshot: key.public_key || publicKey,
            signature
        })
    } catch (error) {
        console.error("Failed to log user key revoke", error)
        return { success: false, error: "Failed to log user key revoke" }
    }
}