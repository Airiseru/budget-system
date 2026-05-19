"use server"

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireDbm } from './admin'
import { createEntityRepository, createItemRepository, createPapRepository, createUacsRepository } from '../db/factory'
import { ItemCatalogObjectCodeSchema, ItemCatalogSchema, ItemFormState } from '../lib/validations/items'
import { ItemCatalogScope } from '../types/line_items'

const ItemRepository = createItemRepository(process.env.DATABASE_TYPE || 'postgres')
const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')
const UacsRepository = createUacsRepository(process.env.DATABASE_TYPE || 'postgres')

const emptyToUndefined = (value: FormDataEntryValue | null) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

const flattenState = (error: z.ZodError, values: Record<string, string | undefined>): ItemFormState => ({
    ...z.flattenError(error),
    values,
})

function buildStateValues(
    values: Record<string, string | undefined>,
    formData: FormData
) {
    return {
        ...values,
        create_new_object_code: formData.get('create_new_object_code') === 'on' ? 'on' : undefined,
        new_object_description: emptyToUndefined(formData.get('new_object_description')),
        new_chart_account_code: emptyToUndefined(formData.get('new_chart_account_code')),
        new_chart_account_desc: emptyToUndefined(formData.get('new_chart_account_desc')),
        new_sub_object_code: emptyToUndefined(formData.get('new_sub_object_code')),
        new_sub_object_desc: emptyToUndefined(formData.get('new_sub_object_desc')),
        new_object_status: emptyToUndefined(formData.get('new_object_status')) ?? 'active',
    }
}

function buildItemValues(formData: FormData) {
    return {
        scope: (emptyToUndefined(formData.get('scope')) ?? 'global') as ItemCatalogScope,
        entity_id: emptyToUndefined(formData.get('entity_id')) ?? null,
        pap_code: emptyToUndefined(formData.get('pap_code')) ?? null,
        uacs_obj_code: emptyToUndefined(formData.get('uacs_obj_code')) ?? '',
        name: emptyToUndefined(formData.get('name')) ?? '',
        description: emptyToUndefined(formData.get('description')) ?? null,
        expense_class: emptyToUndefined(formData.get('expense_class')) ?? '',
        expense_class_code: emptyToUndefined(formData.get('expense_class_code')) ?? '',
        unit_of_measure: emptyToUndefined(formData.get('unit_of_measure')) ?? null,
    }
}

function buildObjectCodeValues(formData: FormData) {
    return {
        description: emptyToUndefined(formData.get('new_object_description')) ?? '',
        chart_account_code: emptyToUndefined(formData.get('new_chart_account_code')) ?? '',
        chart_account_desc: emptyToUndefined(formData.get('new_chart_account_desc')) ?? null,
        sub_object_code: emptyToUndefined(formData.get('new_sub_object_code')) ?? '',
        sub_object_desc: emptyToUndefined(formData.get('new_sub_object_desc')) ?? null,
        status: (emptyToUndefined(formData.get('new_object_status')) ?? 'active') as 'active' | 'inactive',
    }
}

async function normalizeScopePayload(values: ReturnType<typeof buildItemValues>) {
    if (values.scope === 'global') {
        return {
            ...values,
            entity_id: null,
            pap_code: null,
        }
    }

    if (values.scope === 'entity') {
        return {
            ...values,
            pap_code: null,
        }
    }

    const pap = values.pap_code ? await PapRepository.getPapById(values.pap_code).catch(() => null) : null
    return {
        ...values,
        pap_code: values.pap_code,
        entity_id: pap?.entity_id ?? null,
    }
}

function validateScope(values: Awaited<ReturnType<typeof normalizeScopePayload>>) {
    if (values.scope === 'entity' && !values.entity_id) {
        return 'Entity is required for entity-scoped items.'
    }

    if (values.scope === 'pap' && !values.pap_code) {
        return 'PAP is required for PAP-scoped items.'
    }

    return null
}

async function resolveObjectCode(formData: FormData, values: ReturnType<typeof buildItemValues>) {
    const createNewObjectCode = formData.get('create_new_object_code') === 'on'

    if (!createNewObjectCode) {
        return {
            uacs_obj_code: values.uacs_obj_code,
            objectCodeState: undefined as ItemFormState,
        }
    }

    const objectCodeValues = buildObjectCodeValues(formData)
    const parsed = ItemCatalogObjectCodeSchema.safeParse(objectCodeValues)
    if (!parsed.success) {
        const flattened = z.flattenError(parsed.error)
        return {
            uacs_obj_code: values.uacs_obj_code,
            objectCodeState: {
                formErrors: flattened.formErrors,
                fieldErrors: {
                    new_object_description: flattened.fieldErrors.description,
                    new_chart_account_code: flattened.fieldErrors.chart_account_code,
                    new_chart_account_desc: flattened.fieldErrors.chart_account_desc,
                    new_sub_object_code: flattened.fieldErrors.sub_object_code,
                    new_sub_object_desc: flattened.fieldErrors.sub_object_desc,
                    new_object_status: flattened.fieldErrors.status,
                },
                values: {
                    ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value == null ? undefined : String(value)])),
                    create_new_object_code: 'on',
                    new_object_description: objectCodeValues.description,
                    new_chart_account_code: objectCodeValues.chart_account_code,
                    new_chart_account_desc: objectCodeValues.chart_account_desc ?? undefined,
                    new_sub_object_code: objectCodeValues.sub_object_code,
                    new_sub_object_desc: objectCodeValues.sub_object_desc ?? undefined,
                    new_object_status: objectCodeValues.status,
                },
            },
        }
    }

    const createdObjectCode = await UacsRepository.createObjectCode({
        description: parsed.data.description,
        chart_account_code: parsed.data.chart_account_code,
        chart_account_desc: parsed.data.chart_account_desc ?? null,
        sub_object_code: parsed.data.sub_object_code,
        sub_object_desc: parsed.data.sub_object_desc ?? null,
        status: parsed.data.status,
    })

    return {
        uacs_obj_code: createdObjectCode.code,
        objectCodeState: undefined as ItemFormState,
    }
}

export async function loadItemDashboard() {
    await requireDbm()

    const [itemCatalog, entitySegments, paps, objectCodes] = await Promise.all([
        ItemRepository.listItemCatalog(),
        EntityRepository.getAllEntitySegments(true),
        PapRepository.getPaginatedPaps({ limit: 500, offset: 0 }),
        UacsRepository.listObjectCodes(),
    ])

    return {
        items: itemCatalog.items,
        entities: [
            ...entitySegments.departments,
            ...entitySegments.agencies,
            ...entitySegments.operatingUnits,
        ],
        paps: paps.paps,
        objectCodes: objectCodes.filter((code) => code.status === 'active'),
    }
}

export async function loadItemRecord(id: string) {
    await requireDbm()

    const record = await ItemRepository.getItemCatalogById(id)
    if (!record) return null

    const dashboard = await loadItemDashboard()

    return {
        record,
        ...dashboard,
    }
}

export async function createItemCatalogAction(state: ItemFormState, formData: FormData): Promise<ItemFormState> {
    await requireDbm()

    const rawValues = buildItemValues(formData)
    const normalizedValues = await normalizeScopePayload(rawValues)
    const valuesForState = Object.fromEntries(
        Object.entries(normalizedValues).map(([key, value]) => [key, value == null ? undefined : String(value)])
    )
    const stateValues = buildStateValues(valuesForState, formData)

    const scopeError = validateScope(normalizedValues)
    if (scopeError) {
        return {
            formErrors: [scopeError],
            values: stateValues,
        }
    }

    try {
        const objectCodeResolution = await resolveObjectCode(formData, rawValues)
        if (objectCodeResolution.objectCodeState) {
            return objectCodeResolution.objectCodeState
        }

        const parsed = ItemCatalogSchema.safeParse({
            ...normalizedValues,
            uacs_obj_code: objectCodeResolution.uacs_obj_code,
        })

        if (!parsed.success) {
            return flattenState(parsed.error, stateValues)
        }

        await ItemRepository.createItemCatalog({
            ...parsed.data,
        })
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to create item catalog entry.'],
            values: stateValues,
        }
    }

    revalidatePath('/dbm/items')
    redirect('/dbm/items')
}

export async function updateItemCatalogAction(state: ItemFormState, formData: FormData): Promise<ItemFormState> {
    await requireDbm()

    const id = emptyToUndefined(formData.get('id'))
    if (!id) {
        return { formErrors: ['Item ID is required.'] }
    }

    const rawValues = buildItemValues(formData)
    const normalizedValues = await normalizeScopePayload(rawValues)
    const valuesForState = Object.fromEntries(
        Object.entries(normalizedValues).map(([key, value]) => [key, value == null ? undefined : String(value)])
    )
    const stateValues = buildStateValues(valuesForState, formData)

    const scopeError = validateScope(normalizedValues)
    if (scopeError) {
        return {
            formErrors: [scopeError],
            values: stateValues,
        }
    }

    try {
        const objectCodeResolution = await resolveObjectCode(formData, rawValues)
        if (objectCodeResolution.objectCodeState) {
            return objectCodeResolution.objectCodeState
        }

        const parsed = ItemCatalogSchema.safeParse({
            ...normalizedValues,
            uacs_obj_code: objectCodeResolution.uacs_obj_code,
        })

        if (!parsed.success) {
            return flattenState(parsed.error, stateValues)
        }

        await ItemRepository.updateItemCatalog(id, {
            ...parsed.data,
        })
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to update item catalog entry.'],
            values: stateValues,
        }
    }

    revalidatePath('/dbm/items')
    redirect('/dbm/items')
}

export async function deleteItemCatalogAction(
    state: ItemFormState,
    formData: FormData
): Promise<ItemFormState> {
    await requireDbm()

    const id = emptyToUndefined(formData.get('id'))
    if (!id) {
        return { formErrors: ['Item ID is required.'] }
    }

    try {
        await ItemRepository.deleteItemCatalog(id)
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to delete item catalog entry.'],
        }
    }

    revalidatePath('/dbm/items')
    redirect('/dbm/items')
}
