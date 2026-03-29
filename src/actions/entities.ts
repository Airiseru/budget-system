'use server'

import { sessionWithEntity } from './auth'
import { requireAdmin } from './admin'
import { createEntityRepository } from '../db/factory'
import { Department, Agency, OperatingUnit } from '../types/entities'

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export async function loadEntities(): Promise<{} | {
    departments: Partial<Department[]>,
    agencies: Partial<Agency[]>,
    operatingUnits: Partial<OperatingUnit[]>,
    entityName: string
}> {
    await requireAdmin()

    const session = await sessionWithEntity()
    if (!session) return {}
    if (!session.user.entity_id) return {}

    if (session.user_entity.entity_type === "national") {
        return {
            ...await EntityRepository.getAllEntitySegments(),
            entityName: session.user_entity.entity_name,
        }
    }
    else if (session.user_entity.entity_type === "department") {
        return {
            departments: [],
            ...await EntityRepository.getEntitySegmentsByDepartment(session.user.entity_id),
            entityName: session.user_entity.entity_name,
        }
    }
    else if (session.user_entity.entity_type === "agency") {
        return { 
            departments: [],
            agencies: [],
            operatingUnits: await EntityRepository.getAllOperatingUnitsByAgencyId(session.user.entity_id),
            entityName: session.user_entity.entity_name,
        }
    }

    return {}
}