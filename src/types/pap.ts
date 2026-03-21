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
    category: 'local' | 'foreign'
    title: string
    description: string | null
    purpose: string
    beneficiaries: string
    project_type: string | null
    uacs_pap_code: string | null
    actual_start_date: Date | null
    project_status: 'draft' | 'proposed' | 'approved' | 'for release' | 'terminating' | 'on-going' | 'completed' | 'rejected' | 'cancelled'
    auth_status: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type Pap = Selectable<PapTable>
export type NewPap = Insertable<PapTable>
export type PapUpdate = Updateable<PapTable>

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

export type PapLocation = Selectable<PapLocationTable>
export type NewPapLocation = Insertable<PapLocationTable>
export type PapLocationUpdate = Updateable<PapLocationTable>