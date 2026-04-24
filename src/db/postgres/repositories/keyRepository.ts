import { db } from '../database'
import { sql } from 'kysely'
import {
    UserKey, NewUserKey, UserKeyUpdate, UserKeyStatus, UserKeyStatuses,
    Signatory, NewSignatory
} from '../../../types/keys'

async function getLatestDraftResetByFormId(form_id: string) {
    return await db
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
    return await db.insertInto('signatories').values(signatory).returningAll().executeTakeFirstOrThrow()
}

export async function getSignatoriesOfUser(user_id: string): Promise<Signatory[]> {
    return await db.selectFrom('signatories').selectAll().where('user_id', '=', user_id).execute()
}

export async function getSignatoriesByFormId(form_id: string) {
    const latestDraftReset = await getLatestDraftResetByFormId(form_id)

    let query = db
        .selectFrom('signatories')
        .innerJoin('users', 'users.id', 'signatories.user_id')
        .select([
            'signatories.id',
            'users.name as user_name',
            'signatories.role',
            'signatories.created_at'
        ])
        .where('signatories.form_id', '=', form_id)
        .where('signatories.signature', 'is not', null)

    if (latestDraftReset?.changed_at) {
        query = query.where('signatories.created_at', '>', latestDraftReset.changed_at)
    }

    return await query
        .orderBy('signatories.created_at', 'asc')
        .execute()
}

export async function getPastSignatoriesByFormId(form_id: string) {
    const latestDraftReset = await getLatestDraftResetByFormId(form_id)

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
            'signatories.created_at'
        ])
        .where('signatories.form_id', '=', form_id)
        .where('signatories.signature', 'is not', null)
        .where('signatories.created_at', '<=', latestDraftReset.changed_at)
        .orderBy('signatories.created_at', 'desc')
        .execute()
}

export async function getSignatoryByFormIdAndUserId(form_id: string, user_id: string): Promise<Signatory | null> {
    const latestDraftReset = await getLatestDraftResetByFormId(form_id)

    let query = db
        .selectFrom('signatories')
        .selectAll()
        .where('form_id', '=', form_id)
        .where('user_id', '=', user_id)

    if (latestDraftReset?.changed_at) {
        query = query.where('created_at', '>', latestDraftReset.changed_at)
    }

    const signatory = await query
        .orderBy('created_at', 'desc')
        .executeTakeFirst()

    if (!signatory) {
        return null
    }

    return signatory
}

export async function getSignatoryById(id: string): Promise<Signatory | null> {
    return await db.selectFrom('signatories').selectAll().where('id', '=', id).executeTakeFirstOrThrow()
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
            'signatories.form_id',
            'signatories.signature',
            'signatories.public_key_snapshot',
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
