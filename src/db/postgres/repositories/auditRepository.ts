import { db } from "../database"
import {
    computeAuditEntryHash,
    verifyChain
} from "@/src/lib/audit-hash"
import { verifySignature } from "@/src/lib/crypto"
import { 
    AuditLog, 
    NewAuditLog,
    SignaturePayload,
    AuditLogEntryPayload,
    AuditEventType,
    REQUIRES_SIGNATURE
} from "../../../types/audit"

export async function createLog(log: Omit<NewAuditLog, 'hash'>, signingPayload: SignaturePayload | string | null): Promise<AuditLog> {
    let editedLog: NewAuditLog = {
        ...log,
        table_name: log.table_name ?? null,
        record_id: log.record_id ?? null,
        payload: log.payload ?? null,
        public_key_snapshot: log.public_key_snapshot ?? null,
        signature: log.signature ?? null,
        hash: ''
    }
    const requiresSignature = REQUIRES_SIGNATURE.includes(log.event_type as AuditEventType)

    if (requiresSignature) {
        if (!log.public_key_snapshot || !log.signature || !signingPayload) {
            throw new Error(`${log.event_type} requires a digital signature`)
        }

        const isValid = await verifySignature(
            signingPayload,
            log.signature,
            log.public_key_snapshot
        )

        if (!isValid) throw new Error('Invalid digital signature')
    }

    return await db.transaction().execute(async (trx) => {
        const lastLog = await trx
            .selectFrom('audit_logs')
            .select('hash')
            .where('entity_id', '=', log.entity_id)
            .orderBy('changed_at', 'desc')
            .limit(1)
            .forUpdate()
            .executeTakeFirst()

        const prevHash = lastLog ? lastLog.hash : null
        const changedAt = requiresSignature && log.changed_at
            ? new Date(log.changed_at)
            : new Date()
        
        const newHash = computeAuditEntryHash({
            entity_id: log.entity_id,
            user_id: log.user_id,
            event_type: log.event_type as AuditLogEntryPayload['event_type'],
            table_name: log.table_name ?? "NULL",
            record_id: log.record_id ?? "NULL",
            payload: log.payload ?? "NULL",
            changed_at: changedAt.toISOString(),
        })

        editedLog.changed_at = changedAt
        editedLog.prev_hash = prevHash
        editedLog.hash = newHash

        return await trx
            .insertInto('audit_logs')
            .values({
                ...editedLog,
                payload: log.payload ? JSON.stringify(log.payload) : null,
            })
            .returningAll()
            .executeTakeFirstOrThrow()
    })
}

export async function getHistory(tableName: string, recordId: string) {
    return await db
        .selectFrom('audit_logs')
        .leftJoin('users', 'users.id', 'audit_logs.user_id')
        .select([
            'audit_logs.id',
            'audit_logs.event_type',
            'audit_logs.payload',
            'audit_logs.changed_at',
            'audit_logs.hash',
            'audit_logs.signature',
            'users.name as user_name'
        ])
        .where('audit_logs.table_name', '=', tableName)
        .where('audit_logs.record_id', '=', recordId)
        .orderBy('audit_logs.changed_at', 'asc')
        .execute()
}

export async function verifyEntityChain(entityId: string) {
    const logs = await db
        .selectFrom('audit_logs')
        .selectAll()
        .where('entity_id', '=', entityId)
        .orderBy('changed_at', 'asc')
        .execute()

    return await verifyChain(logs)
}