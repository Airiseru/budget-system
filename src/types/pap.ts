import {
    Generated,
    ColumnType,
    Insertable,
    Selectable,
    Updateable
} from 'kysely'
import { PAP_PROJECT_STATUS_TYPES } from '../lib/constants'

import { Feature } from 'geojson'

export interface PapTable {
    id: Generated<string>
    entity_id: string | null
    org_outcome_id: string
    pip_code: string | null
    category: 'local' | 'foreign'
    title: string
    description: string | null
    purpose: string
    beneficiaries: string
    project_type: string | null
    cost_structure_code: string | null
    organizational_outcome_code: string | null
    program_code: string | null
    subprogram_code: string | null
    identifier_code: '1' | '2' | '3'
    project_title_code: string | null
    reserved_codes: string | null
    actual_start_date: Date | null
    project_status: PAP_PROJECT_STATUS_TYPES
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type Pap = Selectable<PapTable>
export type NewPap = Insertable<PapTable>
export type PapUpdate = Updateable<PapTable>

export interface Address {
    street: string | null
    barangay: string | null
    city: string | null
    province: string | null
    region: string | null
    country: string | null
}

export interface PapLocationTable {
    id: Generated<string>
    pap_id: string
    uacs_loc_code: string
    description: string | null
    geometry: Feature
    address: Address
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type PapLocation = Selectable<PapLocationTable>
export type NewPapLocation = Insertable<PapLocationTable>
export type PapLocationUpdate = Updateable<PapLocationTable>