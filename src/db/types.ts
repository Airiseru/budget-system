import {
    Generated,
    ColumnType,
    Insertable,
    Selectable,
    Updateable
} from 'kysely'

export interface PapTable {
    id: Generated<string>
    entity_id: string
    org_outcome_id: string
    pip_code: string | null
    category: string | null
    title: string
    description: string | null
    purpose: string
    beneficiaries: string
    project_type: string | null
    uacs_pap_code: string | null
    actual_start_date: Date | null
    project_status: string | null
    auth_status: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type PapInsertable = Insertable<PapTable>
export type PapSelectable = Selectable<PapTable>
export type PapUpdatable = Updateable<PapTable>

export interface PapLocationTable {
    id: Generated<string>
    pap_id: string
    uacs_loc_code: string
    description: string | null
    geometry: Record<string, unknown> | null
    region: string | null
    gazetteer: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type PapLocationInsertable = Insertable<PapLocationTable>
export type PapLocationSelectable = Selectable<PapLocationTable>
export type PapLocationUpdatable = Updateable<PapLocationTable>

export interface Database {
    pap: PapTable
    pap_location: PapLocationTable
}