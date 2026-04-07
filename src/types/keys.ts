import {
    Generated,
    Insertable,
    Selectable,
    Updateable
} from 'kysely'

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
    form_id: string
    user_id: string
    role: string // prepared by, certified correct, approved by
    key_id: string
    public_key_snapshot: string
    signature: string
    created_at: Generated<Date>
}

export type Signatory = Selectable<SignatoryTable>
export type NewSignatory = Insertable<SignatoryTable>
