"use server"

import { createAuditRepository } from "@/src/db/factory"
import { sessionWithEntity } from "./auth"
import { computeDiff, isDiffEmpty } from "../lib/diff"
import { AuditEventType, SignaturePayload } from "../types/audit"
import { buildSignaturePayload } from "../lib/audit-hash"

const AuditRepository = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')

export async function logUserSignUp(userId: string, entityId: string) {
    try {
        await AuditRepository.createLog({
            entity_id: entityId,
            user_id: userId,
            event_type: 'SIGNUP',
            table_name: null,
            record_id: null,
            payload: null,
            changed_at: new Date()
        }, null)
        return { success: true }
    } catch (error) {
        console.error("Failed to log user signup", error)
        return { success: false, error: "Failed to log user signup" }
    }
}

export async function logUserLogin(userId: string, entityId: string) {
    try {
        await AuditRepository.createLog({
            entity_id: entityId,
            user_id: userId,
            event_type: 'LOGIN',
            table_name: null,
            record_id: null,
            payload: null,
            changed_at: new Date()
        }, null)
        return { success: true }
    } catch (error) {
        console.error("Failed to log user login", error)
        return { success: false, error: "Failed to log user login" }
    }
}

export async function logUserLogout(userId: string, entityId: string) {
    try {
        await AuditRepository.createLog({
            entity_id: entityId,
            user_id: userId,
            event_type: 'LOGOUT',
            table_name: null,
            record_id: null,
            payload: null,
            changed_at: new Date()
        }, null)
        return { success: true }
    } catch (error) {
        console.error("Failed to log user logout", error)
        return { success: false, error: "Failed to log user logout" }
    }
}