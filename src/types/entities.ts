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

export interface UserTable {
    id: string
    name: string
    email: string
    email_verified: boolean
    image: string | null
    position: string
    role: 'unverified' | 'admin' | 'dbm' | 'agency'
    access_level: 'none' | 'view' | 'encode' | 'review' | 'approve'
    entity_id: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type User = Selectable<UserTable>
export type UserUpdate = Updateable<UserTable>
export type UserRole = 'unverified' | 'admin' | 'dbm' | 'agency';
export type UserAccessLevel = 'none' | 'view' | 'encode' | 'review' | 'approve';

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
    abbr: string
    uacs_code: string
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type Department = Selectable<DepartmentsTable>
export type NewDepartment = Insertable<DepartmentsTable>
export type DepartmentUpdate = Updateable<DepartmentsTable>

export interface AgenciesTable {
    id: string
    department_id: string | null
    name: string
    abbr: string | null
    type: 'bureau' | 'attached_agency'
    uacs_code: string
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type Agency = Selectable<AgenciesTable>
export type NewAgency = Insertable<AgenciesTable>
export type AgencyUpdate = Updateable<AgenciesTable>
export const AgencyTypes = ['bureau', 'attached_agency']

export interface OperatingUnitsTable {
    id: string
    agency_id: string
    name: string
    abbr: string | null
    uacs_code: string
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type OperatingUnit = Selectable<OperatingUnitsTable>
export type NewOperatingUnit = Insertable<OperatingUnitsTable>
export type OperatingUnitUpdate = Updateable<OperatingUnitsTable>

export type EntitySegments = {
    entity_id: string
    entity_type: string
    department_id: string | null
    department_name: string | null
    department_abbr: string | null
    agency_id: string | null
    agency_name: string | null
    agency_abbr: string | null
    operating_unit_id: string | null
    operating_unit_name: string | null
}

export type UserEntity = {
    user_id: string
    user_name: string
    user_email: string
    position: string
    role: UserRole
    access_level: UserAccessLevel
    entity_type: string
    entity_name: string
    user_created_at: Date
    user_updated_at: Date
}