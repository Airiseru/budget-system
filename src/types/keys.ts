import {
    Generated,
    Insertable,
    Selectable,
    Updateable,
} from 'kysely'
import type { SignedAuditEventType } from './audit'
import type { UserAccessLevel, UserWorkflowRole } from './entities'

export interface UserKeyTable {
    id: Generated<string>
    user_id: string
    public_key: string
    device_name: string
    status: 'active' | 'revoked' | 'expired'
    created_at: Generated<Date>
    expires_at: Date
    revoked_at: Date | null
}

export type UserKey = Selectable<UserKeyTable>
export type NewUserKey = Insertable<UserKeyTable>
export type UserKeyUpdate = Updateable<UserKeyTable>
export type UserKeyStatus = 'active' | 'revoked' | 'expired'
export const UserKeyStatuses = ['active', 'revoked', 'expired']

export interface SignatoryTable {
    id: Generated<string>
    target_table: 'forms' | 'budget_cycles'
    target_record_id: string
    source_record_id: string
    user_id: string
    role: string // prepared by, certified correct, approved by
    event_type: SignedAuditEventType
    key_id: string
    public_key_snapshot: string
    signature: string
    signature_payload: string
    form_state_hash: string
    from_status: string
    to_status: string
    remarks: string | null
    signer_workflow_role: UserWorkflowRole | null
    signer_access_level: UserAccessLevel
    signer_entity_id: string | null
    signer_is_admin: boolean
    created_at: Generated<Date>
}

export type Signatory = Selectable<SignatoryTable>
export type NewSignatory = Insertable<SignatoryTable>
