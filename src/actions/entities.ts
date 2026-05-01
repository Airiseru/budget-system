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

type EmptyResult = Record<string, never>

type DepartmentOption = Pick<Department, 'id' | 'name' | 'abbr' | 'uacs_code' | 'status'>
type AgencyOption = Pick<Agency, 'id' | 'name' | 'abbr' | 'uacs_code' | 'type' | 'department_id' | 'status'>
type OperatingUnitOption = Pick<OperatingUnit, 'id' | 'name' | 'abbr' | 'uacs_code' | 'agency_id' | 'parent_ou_id' | 'status'>

type LoadEntitiesResult = EmptyResult | {
    departments: DepartmentOption[]
    agencies: AgencyOption[]
    operatingUnits: OperatingUnitOption[]
    entityName: string
}

type LoadAdminEntitiesResult = EmptyResult | {
    departments: DepartmentOption[]
    agencies: AgencyOption[]
    operatingUnits: OperatingUnitOption[]
    entityName: string
}

export type EntityRequestFormState = {
    formErrors?: string[]
    fieldErrors?: {
        proposed_name?: string[]
        proposed_abbr?: string[]
        proposed_classification?: string[]
        proposed_agency_type?: string[]
        proposed_parent_department_id?: string[]
        proposed_parent_agency_id?: string[]
        proposed_parent_ou_id?: string[]
        legal_basis?: string[]
        uacs_code?: string[]
        dbm_remarks?: string[]
    }
    values?: Record<string, string | undefined>
} | undefined

const EntityRequestSchema = z.object({
    proposed_name: z.string().min(1, { error: 'Name is required' }).max(256, { error: 'Name must be less than 256 characters' }),
    proposed_abbr: z.string().max(16, { error: 'Abbreviation must be less than 16 characters' }).optional(),
    proposed_classification: z.enum(['department', 'agency', 'operating_unit']),
    proposed_agency_type: z.preprocess(
        value => value === '' ? undefined : value,
        z.enum(['bureau', 'attached_agency']).optional()
    ),
    proposed_parent_department_id: z.preprocess(
        value => value === '' ? undefined : value,
        z.string().optional()
    ),
    proposed_parent_agency_id: z.preprocess(
        value => value === '' ? undefined : value,
        z.string().optional()
    ),
    proposed_parent_ou_id: z.preprocess(
        value => value === '' ? undefined : value,
        z.string().optional()
    ),
    legal_basis: z.string().min(1, { error: 'Legal basis is required' }).max(2000, { error: 'Legal basis must be less than 2000 characters' }),
})

function normalizeOptionalValue(value: FormDataEntryValue | null): string | undefined {
    if (typeof value !== 'string') return undefined
    const normalized = value.trim()
    return normalized === '' ? undefined : normalized
}

function normalizeEntityRequestValues(formData: FormData) {
    const proposed_classification = normalizeOptionalValue(formData.get('proposed_classification')) ?? ''
    const isAgencyRequest = proposed_classification === 'agency'
    const isAgencyOrOuRequest = proposed_classification === 'agency' || proposed_classification === 'operating_unit'
    const isOuRequest = proposed_classification === 'operating_unit'

    return {
        proposed_name: normalizeOptionalValue(formData.get('proposed_name')) ?? '',
        proposed_abbr: normalizeOptionalValue(formData.get('proposed_abbr')),
        proposed_classification,
        proposed_agency_type: isAgencyRequest ? normalizeOptionalValue(formData.get('proposed_agency_type')) : undefined,
        proposed_parent_department_id: isAgencyOrOuRequest ? normalizeOptionalValue(formData.get('proposed_parent_department_id')) : undefined,
        proposed_parent_agency_id: isOuRequest ? normalizeOptionalValue(formData.get('proposed_parent_agency_id')) : undefined,
        proposed_parent_ou_id: isOuRequest ? normalizeOptionalValue(formData.get('proposed_parent_ou_id')) : undefined,
        legal_basis: normalizeOptionalValue(formData.get('legal_basis')) ?? '',
    }
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

export async function loadAdminEntities(): Promise<LoadAdminEntitiesResult> {
    const session = await sessionWithEntity()
    if (!session) return {}
    if (session.user.role !== 'admin') return {}
    if (!session.user.entity_id) return {}

    if (session.user_entity.entity_type === 'national') {
        return {
            ...await EntityRepository.getAllEntitySegments(),
            entityName: session.user_entity.entity_name || 'All Entities',
        }
    }

    if (session.user_entity.entity_type === 'department') {
        return {
            departments: [],
            ...await EntityRepository.getEntitySegmentsByDepartment(session.user.entity_id),
            entityName: session.user_entity.entity_name || '',
        }
    }

    if (session.user_entity.entity_type === 'agency') {
        return {
            departments: [],
            agencies: [],
            operatingUnits: await EntityRepository.getAllOperatingUnitsByAgencyId(session.user.entity_id),
            entityName: session.user_entity.entity_name || '',
        }
    }

    return {
        departments: [],
        agencies: [],
        operatingUnits: [],
        entityName: session.user_entity.entity_name || '',
    }
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

    if (!session) redirect('/login')
    if (session.user.role !== 'dbm') {
        return { formErrors: ['Unauthorized access.'] }
    }

    // Extract data
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

export async function createEntityRequestAction(
    state: EntityRequestFormState,
    formData: FormData
): Promise<EntityRequestFormState> {
    const session = await sessionWithEntity()
    if (!session) redirect('/login')
    if (session.user.role !== 'admin') {
        return { formErrors: ['Only admins can request new entities.'] }
    }
    if (!session.user.entity_id) {
        return { formErrors: ['Your account is not linked to an entity.'] }
    }

    const values = normalizeEntityRequestValues(formData)
    const validatedFields = EntityRequestSchema.safeParse(values)
    if (!validatedFields.success) {
        return {
            ...z.flattenError(validatedFields.error),
            values,
        }
    }

    const {
        proposed_name,
        proposed_abbr,
        proposed_classification,
        proposed_agency_type,
        proposed_parent_department_id,
        proposed_parent_agency_id,
        proposed_parent_ou_id,
        legal_basis,
    } = validatedFields.data

    const requested_by_type = session.user_entity.entity_type || 'unknown'
    const requesterEntity = await EntityRepository.getEntityOfUser(session.user.entity_id)
    const finalParentDepartmentId =
        proposed_parent_department_id ||
        (requested_by_type === 'department' ? session.user.entity_id : requesterEntity?.parent_department_id || '')
    const finalParentAgencyId =
        proposed_parent_agency_id ||
        (requested_by_type === 'agency' ? session.user.entity_id : requesterEntity?.parent_agency_id || '')
    const finalParentOuId =
        proposed_parent_ou_id ||
        (requested_by_type === 'operating_unit' ? session.user.entity_id : '')

    try {
        await EntityRepository.createEntityRequest({
            requested_by_id: session.user.entity_id,
            requested_by_type,
            requested_by_user_id: session.user.id,
            proposed_name,
            proposed_abbr: proposed_abbr || null,
            proposed_classification: proposed_classification as 'department' | 'agency' | 'operating_unit',
            proposed_agency_type: proposed_agency_type ? proposed_agency_type as 'bureau' | 'attached_agency' : null,
            proposed_parent_department_id: finalParentDepartmentId || null,
            proposed_parent_agency_id: finalParentAgencyId || null,
            proposed_parent_ou_id: finalParentOuId || null,
            legal_basis,
            status: 'pending',
            dbm_remarks: null,
            resulting_id: null,
        })
    } catch {
        return {
            formErrors: ['Failed to submit entity request. Please try again.'],
            values,
        }
    }

    redirect('/admin/entities')
}

export async function approveEntityRequestAction(
    state: EntityRequestFormState,
    formData: FormData
): Promise<EntityRequestFormState> {
    const session = await sessionWithEntity()
    if (!session) redirect('/login')
    if (session.user.role !== 'dbm') {
        return { formErrors: ['Only DBM can review entity requests.'] }
    }

    const requestId = formData.get('request_id') as string
    const proposed_name = formData.get('proposed_name') as string
    const proposed_abbr = formData.get('proposed_abbr') as string
    const proposed_classification = formData.get('proposed_classification') as string
    const proposed_agency_type = formData.get('proposed_agency_type') as string
    const proposed_parent_department_id = formData.get('proposed_parent_department_id') as string
    const proposed_parent_agency_id = formData.get('proposed_parent_agency_id') as string
    const proposed_parent_ou_id = formData.get('proposed_parent_ou_id') as string
    const legal_basis = formData.get('legal_basis') as string
    const uacs_code = formData.get('uacs_code') as string
    const dbm_remarks = formData.get('dbm_remarks') as string

    const values = {
        request_id: requestId,
        proposed_name,
        proposed_abbr,
        proposed_classification,
        proposed_agency_type,
        proposed_parent_department_id,
        proposed_parent_agency_id,
        proposed_parent_ou_id,
        legal_basis,
        uacs_code,
        dbm_remarks,
    }

    const request = await EntityRepository.getEntityRequestById(requestId)
    if (!request || request.status !== 'pending') {
        return { formErrors: ['Entity request is no longer pending.'] }
    }

    try {
        let resultingId: string | null = null

        if (proposed_classification === 'department') {
            const validatedFields = DepartmentSchema.safeParse({
                name: proposed_name,
                abbr: proposed_abbr,
                uacs_code,
            })

            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values,
                }
            }

            const created = await EntityRepository.createDepartment({
                name: proposed_name,
                abbr: proposed_abbr,
                uacs_code,
            })
            resultingId = created.id
        } else if (proposed_classification === 'agency') {
            const validatedFields = AgencySchema.safeParse({
                name: proposed_name,
                abbr: proposed_abbr || null,
                uacs_code,
                type: proposed_agency_type,
                department_id: proposed_parent_department_id || null,
            })

            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values,
                }
            }

            const created = await EntityRepository.createAgency({
                name: proposed_name,
                abbr: proposed_abbr || null,
                uacs_code,
                type: proposed_agency_type as 'bureau' | 'attached_agency',
            }, proposed_parent_department_id || null)
            resultingId = created.id ?? null
        } else {
            const parentOu = proposed_parent_ou_id ? await EntityRepository.getOperatingUnitById(proposed_parent_ou_id) : null
            const finalAgencyId = parentOu?.agency_id || proposed_parent_agency_id

            const validatedFields = OperatingUnitSchema.safeParse({
                name: proposed_name,
                abbr: proposed_abbr || null,
                uacs_code,
                agency_id: finalAgencyId,
                parent_ou_id: proposed_parent_ou_id || null,
            })

            if (!validatedFields.success) {
                return {
                    ...z.flattenError(validatedFields.error),
                    values,
                }
            }

            const created = await EntityRepository.createOperatingUnit({
                name: proposed_name,
                abbr: proposed_abbr || null,
                uacs_code,
                parent_ou_id: proposed_parent_ou_id || null,
            }, finalAgencyId || '')
            resultingId = created.id ?? null
        }

        await EntityRepository.updateEntityRequest(requestId, {
            status: 'approved',
            dbm_remarks: dbm_remarks || null,
            resulting_id: resultingId,
        })
    } catch {
        return {
            formErrors: ['Failed to approve entity request. Please try again.'],
            values,
        }
    }

    redirect('/dbm/entity-requests')
}

export async function rejectEntityRequestAction(
    state: EntityRequestFormState,
    formData: FormData
): Promise<EntityRequestFormState> {
    const session = await sessionWithEntity()
    if (!session) redirect('/login')
    if (session.user.role !== 'dbm') {
        return { formErrors: ['Only DBM can review entity requests.'] }
    }

    const requestId = formData.get('request_id') as string
    const dbm_remarks = formData.get('dbm_remarks') as string

    if (!dbm_remarks.trim()) {
        return {
            fieldErrors: {
                dbm_remarks: ['Remarks are required when rejecting a request.'],
            },
            values: {
                request_id: requestId,
                dbm_remarks,
            },
        }
    }

    try {
        await EntityRepository.updateEntityRequest(requestId, {
            status: 'rejected',
            dbm_remarks,
        })
    } catch {
        return {
            formErrors: ['Failed to reject entity request. Please try again.'],
            values: {
                request_id: requestId,
                dbm_remarks,
            },
        }
    }

    redirect('/dbm/entity-requests')
}
