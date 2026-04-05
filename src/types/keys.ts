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
    status: 'active' | 'revoked'
    created_at: Generated<Date>
    expires_at: Date
    revoked_at: Date | null
}

export type UserKey = Selectable<UserKeyTable>
export type NewUserKey = Insertable<UserKeyTable>

export interface SignatoryTable {
    id: Generated<string>
    form_id: string
    user_id: string
    key_id: string
    public_key_snapshot: string
    signature: string
    created_at: Generated<Date>
}

export type Signatory = Selectable<SignatoryTable>
export type NewSignatory = Insertable<SignatoryTable>
