import {
    Generated,
    ColumnType,
    Selectable,
} from 'kysely'

export const UacsStatus = ['active', 'inactive']
export type UacsStatusType = typeof UacsStatus[number]

export interface UacsTable {
    code: string
    description: string
    status: UacsStatusType
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export interface UacsFundingSourceTable {
    code: string
    description: string
    cluster_code: string
    cluster_desc: string | null
    financing_code: string
    financing_desc: string | null
    auth_code: string
    auth_desc: string | null
    category_code: string
    category_desc: string | null
    status: UacsStatusType
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export interface UacsLocationsTable {
    code: string
    description: string
    region_code: string
    region_desc: string | null
    province_code: string
    province_desc: string | null
    city_municipality_code: string
    city_municipality_desc: string | null
    brgy_code: string
    brgy_desc: string | null
    status: UacsStatusType
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export interface UacsObjectCodesTable {
    code: string
    description: string
    chart_account_code: string
    chart_account_desc: string | null
    sub_object_code: string
    sub_object_desc: string | null
    status: UacsStatusType
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type UacsFundingSource = Selectable<UacsFundingSourceTable>
export type UacsLocation = Selectable<UacsLocationsTable>
export type UacsObjectCode = Selectable<UacsObjectCodesTable>
