import { createHash } from "crypto"
import { AuditLog, AuditLogEntryPayload, SignaturePayload } from "../types/audit"

export function computeAuditEntryHash(entry: AuditLogEntryPayload): string {
    // Replace null values with strings
    entry.table_name = entry.table_name ?? "NULL"
    entry.record_id = entry.record_id ?? "NULL"
    entry.payload = entry.payload ?? "NULL"

    // Stringify stored keys
    const stringEntry = JSON.stringify(entry, Object.keys(entry).sort())

    // Create hash
    return createHash('sha256').update(stringEntry).digest('hex')
}

export function buildSignaturePayload(log: AuditLogEntryPayload): string {
    return JSON.stringify({
        entity_id: log.entity_id,
        user_id: log.user_id,
        event_type: log.event_type,
        table_name: log.table_name ?? null,
        record_id: log.record_id ?? null,
        changed_at: log.changed_at,
        payload: log.payload ?? null,
    }, Object.keys(log).sort())
}

export function hashFormData(data: Record<string, unknown>): string {
    return createHash('sha256')
        .update(JSON.stringify(data, Object.keys(data).sort()))
        .digest('hex')
}

export function verifyChain(logs: AuditLog[]): {
    isValid: boolean,
    brokenAt: string | null
} {
    const sorted = [...logs].sort(
        (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    )

    for (const log of sorted) {
        const expected = computeAuditEntryHash({
            entity_id: log.entity_id,
            user_id: log.user_id,
            event_type: log.event_type as AuditLogEntryPayload['event_type'],
            table_name: log.table_name ?? "NULL",
            record_id: log.record_id ?? "NULL",
            payload: log.payload ?? "NULL",
            changed_at: (new Date(log.changed_at)).toISOString(),
        })

        if (expected !== log.hash) {
            return { isValid: false, brokenAt: log.id }
        }
    }

    return { isValid: true, brokenAt: null }
}