'use server'

import { createEntityRepository } from '@/src/db/factory'
import { sessionDetails, sessionWithEntity } from './auth'
import { revalidatePath } from 'next/cache'
import { UserEntity, UserRole, UserAccessLevel, UserWorkflowRole } from '@/src/types/entities'
import { redirect } from 'next/navigation'
import { isAdminUser } from '../lib/user-status'

export async function requireAdmin(
) {
    const session = await sessionDetails()
    if (!session || !isAdminUser(session.user)) {
        redirect('/home')
    }
}

export async function requireDbm(
) {
    const session = await sessionDetails()
    if (!session || session?.user?.role !== 'dbm') {
        redirect('/home')
    }
}

async function getScopedPendingUsersForAdmin(): Promise<UserEntity[]> {
    const session = await sessionWithEntity()
    if (!session || !isAdminUser(session.user)) {
        redirect('/home')
    }

    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    const pendingUsers = await entityRepository.getPendingUsers()
    const adminEntityId = session.user.entity_id
    const adminEntityType = session.user_entity?.entity_type

    if (!adminEntityId || adminEntityType === 'national') {
        return pendingUsers
    }

    const allowedEntityIds = new Set<string>(
        await entityRepository.getAccessibleEntityIds(adminEntityId)
    )

    return pendingUsers.filter((user) => !!user.entity_id && allowedEntityIds.has(user.entity_id))
}

export async function getPendingUsers() {
    await requireAdmin()
    return await getScopedPendingUsersForAdmin()
}

export async function approveUser(
    id: string,
    role: UserRole,
    access_level: UserAccessLevel,
    workflow_role: UserWorkflowRole | null,
    is_admin: boolean
) {
    await requireAdmin()
    const scopedPendingUsers = await getScopedPendingUsersForAdmin()
    if (!scopedPendingUsers.some((user) => user.user_id === id)) {
        throw new Error('You may only approve pending users under your entity and its child entities.')
    }

    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

    await entityRepository.updateUser(id, {
        role,
        access_level,
        workflow_role,
        is_admin,
        status: 'active',
        archived_at: null,
    })
    revalidatePath('/admin/pending')
}

export async function denyUser(id: string) {
    await requireAdmin()
    const scopedPendingUsers = await getScopedPendingUsersForAdmin()
    if (!scopedPendingUsers.some((user) => user.user_id === id)) {
        throw new Error('You may only reject pending users under your entity and its child entities.')
    }

    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    await entityRepository.deleteUser(id)
    revalidatePath('/admin/pending')
}
