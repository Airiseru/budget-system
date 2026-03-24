'use server'

import { createEntityRepository } from '@/src/db/factory'
import { auth } from "@/src/lib/auth"
import { headers } from "next/headers"

export async function createUserEntity() {
    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    return await entityRepository.createEntity({ type: 'user' })
}

export async function deleteUserEntity(id: string) {
    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    return await entityRepository.deleteEntity(id)
}

export async function sessionDetails() {
    return await auth.api.getSession({
        headers: await headers()
    })
}