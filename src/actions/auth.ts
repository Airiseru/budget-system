'use server'

import { auth } from "@/src/lib/auth"
import { headers } from "next/headers"
import { createEntityRepository } from "../db/factory"

export async function sessionDetails() {
    return await auth.api.getSession({
        headers: await headers()
    })
}

export async function sessionWithEntity() {
    const session = await sessionDetails()
    if (!session) return null

    const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    const entity = await EntityRepository.getEntityOfUser(session.user.entity_id || '')

    const entityName =
        entity?.entity_type === 'national' ? 'All Entities' :
        entity?.entity_type === 'department' ? entity.department_name :
        entity?.entity_type === 'agency' ? entity.agency_name :
        entity?.entity_type === 'operating_unit' ? entity.operating_unit_name :
        null

    return {
        ...session,
        user_entity: {
            entity_type: entity?.entity_type,
            entity_name: entityName,
        }
    }
}