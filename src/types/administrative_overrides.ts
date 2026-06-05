import {
    Generated,
    Insertable,
    Selectable,
    Updateable,
} from 'kysely'

export interface AdministrativeOverrideTable {
    id: Generated<string>
    target_table: string
    target_record_id: string
    overridden_by: string
    justification_remark: string
    legal_directive_ref: string | null
    snapshot_before: unknown
    snapshot_after: unknown
    created_at: Generated<Date>
}

export type AdministrativeOverride = Selectable<AdministrativeOverrideTable>
export type NewAdministrativeOverride = Insertable<AdministrativeOverrideTable>
export type AdministrativeOverrideUpdate = Updateable<AdministrativeOverrideTable>
