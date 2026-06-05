import { db } from '../database'
import { NewAdministrativeOverride } from '../../../types/administrative_overrides'

export type AdministrativeOverrideEntry = {
    id: string
    target_table: string
    target_record_id: string
    overridden_by: string
    overridden_by_name: string | null
    justification_remark: string
    legal_directive_ref: string | null
    created_at: Date
}

export async function createAdministrativeOverride(values: NewAdministrativeOverride) {
    return await db
        .insertInto('administrative_overrides')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function listAdministrativeOverridesByTargets(
    targetTable: string,
    targetRecordIds: string[]
): Promise<AdministrativeOverrideEntry[]> {
    if (targetRecordIds.length === 0) return []

    return await db
        .selectFrom('administrative_overrides')
        .leftJoin('users', 'users.id', 'administrative_overrides.overridden_by')
        .select([
            'administrative_overrides.id as id',
            'administrative_overrides.target_table as target_table',
            'administrative_overrides.target_record_id as target_record_id',
            'administrative_overrides.overridden_by as overridden_by',
            'users.name as overridden_by_name',
            'administrative_overrides.justification_remark as justification_remark',
            'administrative_overrides.legal_directive_ref as legal_directive_ref',
            'administrative_overrides.created_at as created_at',
        ])
        .where('administrative_overrides.target_table', '=', targetTable)
        .where('administrative_overrides.target_record_id', 'in', targetRecordIds)
        .orderBy('administrative_overrides.created_at', 'desc')
        .execute()
}
