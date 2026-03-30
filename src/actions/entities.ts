'use server'

import { sessionWithEntity } from './auth'
import { requireAdmin } from './admin'
import { createEntityRepository } from '../db/factory'
import { Department, Agency, OperatingUnit } from '../types/entities'
import { NewEntityFormState, EditEntityFormState, DeleteEntityFormState } from '../lib/validations/entities'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { DepartmentSchema, AgencySchema, OperatingUnitSchema } from '../lib/validations/entities'

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export async function loadEntities(needsAdmin = false): Promise<{} | {
    departments: Partial<Department[]>,
    agencies: Partial<Agency[]>,
    operatingUnits: Partial<OperatingUnit[]>,
    entityName: string
}> {
    if (needsAdmin) {
        await requireAdmin()
    }

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
    
    // Check if department_id is null
    const raw_dept_id = formData.get('department_id') as string
    const department_id = raw_dept_id ? raw_dept_id : null 
    
    const agency_id = formData.get('agency_id') as string

    const values = { name, abbr, uacs_code, type, department_id: department_id ?? undefined, agency_id }

    const userEntityType = session.user_entity.entity_type
    const userEntityId = session.user.entity_id

    if (userEntityType === 'agency' && entityType !== 'operating_unit') {
        return { formErrors: ['Agency admins can only create operating units'] }
    }
    if (userEntityType === 'department' && entityType === 'department') {
        return { formErrors: ['Department admins cannot create departments'] }
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
            const validatedFields = AgencySchema.safeParse({ name, uacs_code, type, department_id })

            const finalDeptId = 
                (userEntityType === "national" || !userEntityType) // National Admin
                    ? (department_id || undefined) // Uses form data (converts "" to undefined)
                    : userEntityType === "department" // Department Admin
                        ? userEntityId // Forces their own department ID
                        : undefined

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
            const finalAgencyid = 
                (userEntityType === "national" || userEntityType === "department" || !userEntityType) // National or Department Admin
                    ? (agency_id || undefined) // Uses form data (converts "" to undefined)
                    : userEntityType === "agency" // Agency Admin
                        ? userEntityId // Forces their own agency ID
                        : undefined
            
            const validatedFields = OperatingUnitSchema.safeParse({ name, abbr, uacs_code, agency_id: finalAgencyid })

            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values: { name, abbr, uacs_code, agency_id: finalAgencyid ?? undefined }
                }
            }
            await EntityRepository.createOperatingUnit({ name, uacs_code }, finalAgencyid || "")
        }
    } catch (err) {
        return {
            formErrors: ['Failed to create entity. Please try again'],
            values: values
        }
    }

    redirect('/admin/entities')
}

export async function updateEntity(state: EditEntityFormState, formData: FormData): Promise<EditEntityFormState> {
    const session = await sessionWithEntity()

    // 1. Basic Auth Checks
    if (!session) redirect('/login')
    if (session.user.role !== 'admin') {
        return { formErrors: ['Unauthorized access.'] }
    }

    // 2. Extract Data
    const entity_id = formData.get('entity_id') as string
    const entity_type = formData.get('entity_type') as string 
    const name = formData.get('name') as string
    const abbr = formData.get('abbr') as string
    const uacs_code = formData.get('uacs_code') as string
    const type = formData.get('type') as string 
    
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
        agency_id 
    }

    // 3. RBAC
    const userEntityType = session.user_entity.entity_type
    const userEntityId = session.user.entity_id

    if (userEntityType === 'agency' && entity_type !== 'operating_unit') {
        return { formErrors: ['Agency admins can only update operating units'] }
    }
    if (userEntityType === 'department' && entity_type === 'department') {
        return { formErrors: ['Department admins cannot update departments'] }
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
            const finalDeptId = 
                (userEntityType === "national" || !userEntityType) // National Admin
                    ? (department_id || undefined) // Uses form data (converts "" to undefined)
                    : userEntityType === "department" // Department Admin
                        ? userEntityId // Forces their own department ID
                        : undefined

            const validatedFields = AgencySchema.safeParse({ name, uacs_code, type, finalDeptId })

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
            const finalAgencyid = 
                (userEntityType === "national" || userEntityType === "department" || !userEntityType) // National or Department Admin
                    ? (agency_id || undefined) // Uses form data (converts "" to undefined)
                    : userEntityType === "agency" // Agency Admin
                        ? userEntityId // Forces their own agency ID
                        : undefined
            
            const validatedFields = OperatingUnitSchema.safeParse({ name, uacs_code, agency_id: finalAgencyid })

            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values: { name, abbr, uacs_code, agency_id: finalAgencyid ?? undefined }
                }
            }

            await EntityRepository.updateOperatingUnit(entity_id, { 
                name, 
                abbr,
                uacs_code, 
                agency_id: finalAgencyid || undefined
            })
        }
    } catch (err) {
        return {
            formErrors: ['Failed to update entity. Please check your data and try again.'],
            values
        }
    }

    // 4. On absolute success, route them back to the table
    redirect('/admin/entities')
}

export async function deleteEntityAction(state: DeleteEntityFormState, formData: FormData): Promise<DeleteEntityFormState> {
    const session = await sessionWithEntity()

    if (!session || session.user.role !== 'admin') {
        return { formErrors: ['Unauthorized access.'] }
    }

    const entity_id = formData.get('entity_id') as string

    try {
        await EntityRepository.deleteEntity(entity_id)
    } catch (err) {
        // This catches Foreign Key Constraint errors (e.g., trying to delete a Department that still has Agencies)
        return {
            formErrors: ['Failed to delete entity. Please ensure there are no sub-agencies or operating units attached to it before deleting.'],
        }
    }

    // 3. Route back to the main table on success
    redirect('/admin/entities')
}