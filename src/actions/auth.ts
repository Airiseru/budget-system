'use server'

import { createEntityRepository } from '@/src/db/factory'

export async function createUserEntity() {
    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    return await entityRepository.createEntity({ type: 'user' })
}

export async function deleteUserEntity(id: string) {
    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    return await entityRepository.deleteEntity(id)
}