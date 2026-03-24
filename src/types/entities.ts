import {
    Generated,
    ColumnType,
    Insertable,
    Selectable,
    Updateable
} from 'kysely'

export interface EntitiesTable {
    id: Generated<string>,
    type: string
}

export type Entity = Selectable<EntitiesTable>
export type NewEntity = Insertable<EntitiesTable>
export type EntityUpdate = Updateable<EntitiesTable>

export interface UserTable {
    id: string
    name: string
    email: string
    email_verified: boolean
    image: string | null
    role: string
    entity_id: string | null
    public_key: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export interface SessionTable {
    id: string
    user_id: string
    token: string
    expires_at: Date
    ip_address: string | null
    user_agent: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export interface AccountTable {
    id: string
    user_id: string
    account_id: string
    provider_id: string
    access_token: string | null
    refresh_token: string | null
    access_token_expires_at: Date | null
    refresh_token_expires_at: Date | null
    scope: string | null
    id_token: string | null
    password: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export interface VerificationTable {
    id: string
    identifier: string
    value: string
    expires_at: Date
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export interface DepartmentsTable {
    id: string
    name: string
    uacs_code: string
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type Department = Selectable<DepartmentsTable>
export type NewDepartment = Insertable<DepartmentsTable>
export type DepartmentUpdate = Updateable<DepartmentsTable>