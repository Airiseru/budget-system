import {
    Generated,
    Insertable,
    Selectable
} from 'kysely'

export interface AuditLogTable {
    id: Generated<string>
    entity_id: string
    user_id: string
    event_type: AuditEventType
    table_name: string | null
    record_id : string | null
    payload: any | null
    changed_at: Generated<Date>
    prev_hash: string | null
    hash: string
    public_key_snapshot: string | null
    signature: string | null
}

export type AuditLog = Selectable<AuditLogTable>
export type NewAuditLog = Insertable<AuditLogTable>

export type AuditLogEntryPayload = {
    entity_id: string
    user_id: string
    event_type: AuditEventType
    table_name: string | null
    record_id: string | null
    payload: Record<string, unknown> | string | null
    changed_at: string
}

export type AuditEventType =
    | "NEW_FORM"
    | "SAVE_DRAFT"
    | "NEW_PAP"
    | "UPDATE_PAP"
    | "SUBMIT"
    | "SIGN"
    | "APPROVE_FORM"
    | "REJECT_FORM"
    | "SIGNUP"
    | "LOGIN"
    | "LOGOUT"
    | "REGISTER_KEY"
    | "REVOKE_KEY"
    | "NEW_ENTITY"
    | "EDIT" // users, entities
    | "APPROVE_USER"
    | "REJECT_USER"

export const REQUIRES_SIGNATURE: AuditEventType[] = [
    "SIGN",
    "APPROVE_FORM",
    "REJECT_FORM",
    "EDIT",
    "REVOKE_KEY",
    "APPROVE_USER",
    "REJECT_USER"
]

export const SIGNATORY_EVENTS: AuditEventType[] = [
    'SIGN',
    'APPROVE_FORM',
]

export type FieldDiff = {
    from: unknown
    to: unknown
}

export type Diff = Record<string, FieldDiff>

export type SignaturePayload = {
    entity_id: string
    user_id: string
    event_type: AuditEventType
    table_name: string | null
    record_id: string | null
    changed_at: string
    data: string | Diff | Record<string, unknown> | null
}

export type SignedLogInput = {
    entityId: string
    userId: string
    tableName: string | null
    recordId: string | null
    eventType: AuditEventType
    payload: string | Diff | Record<string, unknown>
    publicKeySnapshot: string
    signature: string
    changed_at: Date
    signaturePayload: string
}