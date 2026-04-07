'use server'

import { createEntityRepository } from '@/src/db/factory'
import { sessionDetails } from './auth'
import { revalidatePath } from 'next/cache'
import { UserRole, UserAccessLevel, UserWorkflowRole } from '@/src/types/entities'
import { redirect } from 'next/navigation'

export async function requireAdmin(
    errorMessage: string = 'Unauthorized: You must be an admin to perform this action.'
) {
    const session = await sessionDetails()
    if (!session || session?.user?.role !== 'admin') {
        redirect('/home')
    }
}

export async function getPendingUsers() {
    await requireAdmin()
    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

    return await entityRepository.getPendingUsers()
}

export async function approveUser(id: string, role: UserRole, access_level: UserAccessLevel, workflow_role: UserWorkflowRole | null) {
    await requireAdmin()
    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

    await entityRepository.updateUser(id, { role: role, access_level: access_level, workflow_role: workflow_role })
    revalidatePath('/admin/pending')
}

export async function denyUser(id: string) {
    await requireAdmin()
    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    await entityRepository.deleteUser(id)
    revalidatePath('/admin/pending')
}