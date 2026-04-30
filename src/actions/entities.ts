'use server'

import { sessionWithEntity } from './auth'
import { requireDbm } from './admin'
import { createEntityRepository } from '../db/factory'
import { Department, Agency, OperatingUnit } from '../types/entities'
import { NewEntityFormState, EditEntityFormState, DeleteEntityFormState } from '../lib/validations/entities'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { DepartmentSchema, AgencySchema, OperatingUnitSchema } from '../lib/validations/entities'

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

type LoadEntitiesResult = Record<string, any> | {
    departments: Partial<Department[]>
    agencies: Partial<Agency[]>
    operatingUnits: Partial<OperatingUnit[]>
    entityName: string
}

export async function loadEntities(needsAdmin = false, isCreate: boolean = false): Promise<LoadEntitiesResult> {
    if (needsAdmin) {
        await requireDbm()
    }

    const session = await sessionWithEntity()
    if (!session) return {}
    if (session.user.role !== 'dbm') return {}
    if (!session.user.entity_id) return {}

    if (session.user_entity.entity_type === "national" || session.user.role === "dbm") {
        const entityName = session.user.role === "dbm" ? "All Entities" : session.user_entity.entity_name || ""
        return {
            ...await EntityRepository.getAllEntitySegments(isCreate),
            entityName,
        }
    }
    else if (session.user_entity.entity_type === "department") {
        return {
            departments: [],
            ...await EntityRepository.getEntitySegmentsByDepartment(session.user.entity_id),
            entityName: session.user_entity.entity_name || "",
        }
    }
    else if (session.user_entity.entity_type === "agency") {
        return { 
            departments: [],
            agencies: [],
            operatingUnits: await EntityRepository.getAllOperatingUnitsByAgencyId(session.user.entity_id),
            entityName: session.user_entity.entity_name || "",
        }
    }

    return {}
}

export async function createNewEntity(
    state: NewEntityFormState,
    formData: FormData
): Promise<NewEntityFormState> {
    const session = await sessionWithEntity()

    if (!session) redirect('login')
    if (session.user.role === 'unverified') redirect('pending-approval')

    const entityType = formData.get('entity_type') as string
    const name = formData.get('name') as string
    const abbr = formData.get('abbr') as string
    const uacs_code = formData.get('uacs_code') as string
    const type = formData.get('type') as string
    const raw_parent_ou_id = formData.get('parent_ou_id') as string
    const parent_ou_id = (raw_parent_ou_id === 'none' || !raw_parent_ou_id) ? null : raw_parent_ou_id
    
    // Check if department_id is null
    const raw_dept_id = formData.get('department_id') as string
    const department_id = raw_dept_id ? raw_dept_id : null 
    
    const agency_id = formData.get('agency_id') as string

    const values = { name, abbr, uacs_code, type, department_id: department_id ?? undefined, agency_id, parent_ou_id: parent_ou_id ?? undefined }

    if (session.user.role !== 'dbm') {
        return { formErrors: ['Only DBM can manage entities.'] }
    }

    try {
        if (entityType === 'department') {
            const validatedFields = DepartmentSchema.safeParse({ name, uacs_code, abbr })
            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values: { name, abbr, uacs_code }
                }
            }
            await EntityRepository.createDepartment({ name, uacs_code, abbr })
        }

        else if (entityType === 'agency') {
            const validatedFields = AgencySchema.safeParse({ name, abbr, uacs_code, type, department_id })
            const finalDeptId = department_id || undefined

            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values: { name, abbr, uacs_code, type, department_id: finalDeptId ?? undefined }
                }
            }
            await EntityRepository.createAgency(
                { name, abbr, uacs_code, type: type as 'bureau' | 'attached_agency' },
                finalDeptId || null
            )
        }

        else if (entityType === 'operating_unit') {
            const parentOu = parent_ou_id ? await EntityRepository.getOperatingUnitById(parent_ou_id) : null
            const finalAgencyid = parentOu?.agency_id || agency_id || undefined
            
            const validatedFields = OperatingUnitSchema.safeParse({ name, abbr, uacs_code, agency_id: finalAgencyid, parent_ou_id })

            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values: { name, abbr, uacs_code, agency_id: finalAgencyid ?? undefined, parent_ou_id: parent_ou_id ?? undefined }
                }
            }
            await EntityRepository.createOperatingUnit({ name, abbr, uacs_code, parent_ou_id }, finalAgencyid || "")
        }
    } catch {
        return {
            formErrors: ['Failed to create entity. Please try again'],
            values: values
        }
    }

    redirect('/dbm/entities')
}

export async function updateEntity(state: EditEntityFormState, formData: FormData): Promise<EditEntityFormState> {
    const session = await sessionWithEntity()

    // 1. Basic Auth Checks
    if (!session) redirect('/login')
    if (session.user.role !== 'dbm') {
        return { formErrors: ['Unauthorized access.'] }
    }

    // 2. Extract Data
    const entity_id = formData.get('entity_id') as string
    const entity_type = formData.get('entity_type') as string 
    const name = formData.get('name') as string
    const abbr = formData.get('abbr') as string
    const uacs_code = formData.get('uacs_code') as string
    const type = formData.get('type') as string 
    const raw_parent_ou_id = formData.get('parent_ou_id') as string
    const parent_ou_id = (raw_parent_ou_id === 'none' || !raw_parent_ou_id) ? null : raw_parent_ou_id
    
    // Safely handle the "none" string from the shadcn select and convert it to null
    const raw_dept_id = formData.get('department_id') as string
    const department_id = (raw_dept_id === 'none' || !raw_dept_id) ? null : raw_dept_id
    
    const agency_id = formData.get('agency_id') as string

    const values = { 
        entity_id, 
        entity_type, 
        name,
        abbr,
        uacs_code, 
        type, 
        department_id: department_id ?? undefined, 
        agency_id,
        parent_ou_id: parent_ou_id ?? undefined
    }
    
    try {
        if (entity_type === 'department') {
            const validatedFields = DepartmentSchema.safeParse({ name, uacs_code, abbr })
            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values: { name, abbr, uacs_code }
                }
            }
            await EntityRepository.updateDepartment(entity_id, { name, abbr, uacs_code })
        } 
        else if (entity_type === 'agency') {
            const finalDeptId = department_id || undefined

            const validatedFields = AgencySchema.safeParse({ name, abbr, uacs_code, type, department_id: finalDeptId })

            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values: { name, abbr, uacs_code, type, department_id: finalDeptId ?? undefined }
                }
            }

            await EntityRepository.updateAgency(entity_id, { 
                name,
                abbr,
                uacs_code, 
                type: type as 'bureau' | 'attached_agency',
                department_id: finalDeptId || null 
            })
        } 
        else if (entity_type === 'operating_unit') {
            const parentOu = parent_ou_id ? await EntityRepository.getOperatingUnitById(parent_ou_id) : null
            const finalAgencyid = parentOu?.agency_id || agency_id || undefined
            
            const validatedFields = OperatingUnitSchema.safeParse({ name, abbr, uacs_code, agency_id: finalAgencyid, parent_ou_id })

            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values: { name, abbr, uacs_code, agency_id: finalAgencyid ?? undefined, parent_ou_id: parent_ou_id ?? undefined }
                }
            }

            await EntityRepository.updateOperatingUnit(entity_id, { 
                name, 
                abbr,
                uacs_code, 
                agency_id: finalAgencyid || undefined,
                parent_ou_id
            })
        }
    } catch {
        return {
            formErrors: ['Failed to update entity. Please check your data and try again.'],
            values
        }
    }

    // 4. On absolute success, route them back to the table
    redirect('/dbm/entities')
}

export async function deactivateEntityAction(state: DeleteEntityFormState, formData: FormData): Promise<DeleteEntityFormState> {
    const session = await sessionWithEntity()

    if (!session || session.user.role !== 'dbm') {
        return { formErrors: ['Unauthorized access.'] }
    }

    const entity_id = formData.get('entity_id') as string

    try {
        await EntityRepository.setEntityAndDescendantsInactive(entity_id)
    } catch {
        return {
            formErrors: ['Failed to deactivate entity. Please try again.'],
        }
    }

    redirect('/dbm/entities')
}
