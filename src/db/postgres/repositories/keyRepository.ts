import { db } from '../database'
import { Kysely, Transaction } from 'kysely'
import {
    UserKey, NewUserKey, UserKeyStatus, UserKeyStatuses,
    Signatory, NewSignatory
} from '../../../types/keys'
import type { SignedAuditEventType } from '@/src/types/audit'
import type { Database } from '@/src/types'

type DbExecutor = Kysely<Database> | Transaction<Database>
type SignatoryTargetTable = 'forms' | 'budget_cycles'

async function getLatestDraftResetByFormId(form_id: string, executor: DbExecutor = db) {
    return await executor
        .selectFrom('audit_logs')
        .select('changed_at')
        .where('record_id', '=', form_id)
        .where('event_type', '=', 'REJECT_FORM')
        .orderBy('changed_at', 'desc')
        .executeTakeFirst()
}

export async function createUserKey(user_key: NewUserKey): Promise<UserKey> {
    return await db.insertInto('user_keys').values(user_key).returningAll().executeTakeFirstOrThrow()
}

export async function updateUserKeyStatus(id: string, status: string): Promise<void> {
    if (!UserKeyStatuses.includes(status as UserKeyStatus)) {
        throw new Error(`Invalid status: ${status}`)
    }

    await db
        .updateTable('user_keys')
        .set({ status: status as UserKeyStatus })
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
}

export async function updateUserKeyDate(id: string, date: Date): Promise<void> {
    await db
        .updateTable('user_keys')
        .set({ expires_at: date })
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
}

export async function revokeUserKey(id: string): Promise<void> {
    // Update status
    await updateUserKeyStatus(id, 'revoked')

    // Update revoked_at date
    await db
        .updateTable('user_keys')
        .set({ revoked_at: new Date() })
        .where('id', '=', id)
        .executeTakeFirstOrThrow()

}

export async function expireOldKeys(user_id: string): Promise<void> {
    await db
        .updateTable('user_keys')
        .set({ status: 'expired' })
        .where('user_id', '=', user_id)
        .where('expires_at', '<', new Date())
        .execute()
}

export async function getUserKeyById(id: string): Promise<UserKey | null> {
    return await db.selectFrom('user_keys').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

export async function getAllKeysOfUser(user_id: string): Promise<UserKey[]> {
    return await db.selectFrom('user_keys').selectAll().where('user_id', '=', user_id).execute()
}

export async function createSignatory(signatory: NewSignatory): Promise<Signatory> {
    return await createSignatoryWithExecutor(signatory, db)
}

export async function createSignatoryWithExecutor(signatory: NewSignatory, executor: DbExecutor): Promise<Signatory> {
    return await executor.insertInto('signatories').values(signatory).returningAll().executeTakeFirstOrThrow()
}

export async function getSignatoriesOfUser(user_id: string): Promise<Signatory[]> {
    return await db.selectFrom('signatories').selectAll().where('user_id', '=', user_id).execute()
}

export async function getSignatoriesByTarget(
    targetTable: SignatoryTargetTable,
    targetRecordId: string,
    sourceRecordId?: string
) {
    const latestDraftReset = targetTable === 'forms'
        ? await getLatestDraftResetByFormId(targetRecordId)
        : null

    let query = db
        .selectFrom('signatories')
        .innerJoin('users', 'users.id', 'signatories.user_id')
        .select([
            'signatories.id',
            'users.name as user_name',
            'signatories.role',
            'signatories.event_type',
            'signatories.created_at',
            'signatories.source_record_id',
            'signatories.signature_payload',
        ])
        .where('signatories.target_table', '=', targetTable)
        .where('signatories.target_record_id', '=', targetRecordId)
        .where('signatories.signature', 'is not', null)

    if (latestDraftReset?.changed_at) {
        query = query.where('signatories.created_at', '>', latestDraftReset.changed_at)
    }

    if (sourceRecordId) {
        query = query.where('signatories.source_record_id', '=', sourceRecordId)
    }

    return await query
        .orderBy('signatories.created_at', 'asc')
        .execute()
}

export async function getSignatoriesByFormId(form_id: string) {
    return await getSignatoriesByTarget('forms', form_id, form_id)
}

export async function getPastSignatoriesByTarget(targetTable: SignatoryTargetTable, targetRecordId: string) {
    if (targetTable !== 'forms') {
        return []
    }

    const latestDraftReset = await getLatestDraftResetByFormId(targetRecordId)

    if (!latestDraftReset?.changed_at) {
        return []
    }

    return await db
        .selectFrom('signatories')
        .innerJoin('users', 'users.id', 'signatories.user_id')
        .select([
            'signatories.id',
            'users.name as user_name',
            'signatories.role',
            'signatories.event_type',
            'signatories.created_at'
        ])
        .where('signatories.target_table', '=', 'forms')
        .where('signatories.target_record_id', '=', targetRecordId)
        .where('signatories.signature', 'is not', null)
        .where('signatories.created_at', '<=', latestDraftReset.changed_at)
        .orderBy('signatories.created_at', 'desc')
        .execute()
}

export async function getPastSignatoriesByFormId(form_id: string) {
    return await getPastSignatoriesByTarget('forms', form_id)
}

export async function getSignatoryByTargetAndUserId(
    targetTable: SignatoryTargetTable,
    targetRecordId: string,
    user_id: string,
    sourceRecordId?: string
): Promise<Signatory | null> {
    const latestDraftReset = targetTable === 'forms'
        ? await getLatestDraftResetByFormId(targetRecordId)
        : null

    let query = db
        .selectFrom('signatories')
        .selectAll()
        .where('target_table', '=', targetTable)
        .where('target_record_id', '=', targetRecordId)
        .where('user_id', '=', user_id)

    if (latestDraftReset?.changed_at) {
        query = query.where('created_at', '>', latestDraftReset.changed_at)
    }

    if (sourceRecordId) {
        query = query.where('source_record_id', '=', sourceRecordId)
    }

    const signatories = await query
        .orderBy('created_at', 'desc')
        .execute()

    if (!signatories[0]) {
        return null
    }

    return signatories[0]
}

export async function getSignatoryByFormIdAndUserId(form_id: string, user_id: string): Promise<Signatory | null> {
    return await getSignatoryByTargetAndUserId('forms', form_id, user_id, form_id)
}

export async function getCurrentCycleSignatoryByFormIdAndUserId(
    form_id: string,
    user_id: string,
    executor: DbExecutor
): Promise<Signatory | null> {
    return await getCurrentCycleSignatoryByTargetAndUserId('forms', form_id, user_id, executor, form_id)
}

export async function getCurrentCycleSignatoryByTargetAndUserId(
    targetTable: SignatoryTargetTable,
    targetRecordId: string,
    user_id: string,
    executor: DbExecutor,
    sourceRecordId?: string
): Promise<Signatory | null> {
    const latestDraftReset = targetTable === 'forms'
        ? await getLatestDraftResetByFormId(targetRecordId, executor)
        : null

    let query = executor
        .selectFrom('signatories')
        .selectAll()
        .where('target_table', '=', targetTable)
        .where('target_record_id', '=', targetRecordId)
        .where('user_id', '=', user_id)

    if (latestDraftReset?.changed_at) {
        query = query.where('created_at', '>', latestDraftReset.changed_at)
    }

    if (sourceRecordId) {
        query = query.where('source_record_id', '=', sourceRecordId)
    }

    const signatories = await query
        .orderBy('created_at', 'desc')
        .execute()

    return signatories[0] ?? null
}

export async function getSignatoryById(id: string): Promise<Signatory | null> {
    return await db.selectFrom('signatories').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
}

export async function listSignatoriesByTarget(
    targetTable: SignatoryTargetTable,
    targetRecordId: string,
    executor: DbExecutor = db
): Promise<Signatory[]> {
    return await executor
        .selectFrom('signatories')
        .selectAll()
        .where('target_table', '=', targetTable)
        .where('target_record_id', '=', targetRecordId)
        .orderBy('created_at', 'asc')
        .execute()
}

export async function listSignatoriesByFormId(form_id: string, executor: DbExecutor = db): Promise<Signatory[]> {
    return await listSignatoriesByTarget('forms', form_id, executor)
}

export async function getMatchingSignatoryForAuditEvent(
    targetTable: SignatoryTargetTable,
    targetRecordId: string,
    user_id: string,
    event_type: SignedAuditEventType,
    signature: string,
    created_at: Date,
    executor: DbExecutor = db
): Promise<Signatory | null> {
    return await executor
        .selectFrom('signatories')
        .selectAll()
        .where('target_table', '=', targetTable)
        .where('target_record_id', '=', targetRecordId)
        .where('user_id', '=', user_id)
        .where('event_type', '=', event_type)
        .where('signature', '=', signature)
        .where('created_at', '=', created_at)
        .executeTakeFirst() ?? null
}

export async function getSignatoryWithKey(signature_id: string) {
    return await db
        .selectFrom('signatories')
        .innerJoin('user_keys', 'user_keys.id', 'signatories.key_id')
        .innerJoin('users', 'users.id', 'signatories.user_id')
        .where('signatories.id', '=', signature_id)
        .select([
            // signatory fields
            'signatories.id',
            'signatories.target_table',
            'signatories.target_record_id',
            'signatories.source_record_id',
            'signatories.event_type',
            'signatories.role',
            'signatories.signature',
            'signatories.signature_payload',
            'signatories.public_key_snapshot',
            'signatories.form_state_hash',
            'signatories.from_status',
            'signatories.to_status',
            'signatories.remarks',
            'signatories.signer_workflow_role',
            'signatories.signer_access_level',
            'signatories.signer_entity_id',
            'signatories.signer_is_admin',
            'signatories.created_at',

            // key fields needed for validation
            'user_keys.status as key_status',
            'user_keys.expires_at',
            'user_keys.revoked_at',
            'user_keys.device_name',
            'user_keys.user_id',

            // user fields for display
            'users.name as signer_name',
            'users.email as signer_email',
        ])
        .executeTakeFirst() ?? null
}
