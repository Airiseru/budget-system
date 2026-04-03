import {
    Generated,
    ColumnType,
    Insertable,
    Selectable,
    Updateable
} from 'kysely'

export interface FormTable {
    id: Generated<string>
    entity_id: string
    pap_id: string
    type: string
    codename: string
    auth_status: string | null
    created_at: Generated<Date>
    updated_at: ColumnType<Date, never, Date>
}

export type Form = Selectable<FormTable>
export type NewForm = Insertable<FormTable>
export type FormUpdate = Updateable<FormTable>