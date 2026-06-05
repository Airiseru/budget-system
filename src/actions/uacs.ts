'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireDbm } from './admin'
import { createUacsRepository } from '../db/factory'
import {
    FundingSourceSchema,
    FundingSourceScopeSchema,
    LocationSchema,
    LocationScopeSchema,
    ObjectCodeSchema,
    ObjectCodeScopeSchema,
    UacsCategorySchema,
    UacsFormState,
} from '../lib/validations/uacs'
import {
    type FundingSourceScope,
    type LocationScope,
    type ObjectCodeScope,
    UacsCategory,
} from '../db/postgres/repositories/uacsRepository'

const UacsRepository = createUacsRepository(process.env.DATABASE_TYPE || 'postgres')

const emptyToUndefined = (value: FormDataEntryValue | null) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

function mergeDefined<T extends Record<string, unknown>>(base: T, updates: Partial<T>): T {
    return Object.fromEntries(
        Object.entries({ ...base, ...updates }).map(([key, value]) => {
            const nextValue = updates[key as keyof T]
            if (nextValue === undefined) {
                return [key, base[key as keyof T]]
            }
            return [key, value]
        })
    ) as T
}

function toStateValues(values: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value == null ? undefined : String(value)])
    )
}

function flatten(result: { success: false; error: z.ZodError }, values: Record<string, string | undefined>): UacsFormState {
    if (result.success) return undefined
    return {
        ...z.flattenError(result.error),
        values,
    }
}

type FundingPayloadValues = {
    description?: string
    cluster_code?: string
    cluster_desc?: string | null
    financing_code?: string
    financing_desc?: string | null
    auth_code?: string
    auth_desc?: string | null
    category_code?: string
    category_desc?: string | null
    status?: string
}

type LocationPayloadValues = {
    description?: string
    region_code?: string
    region_desc?: string | null
    province_code?: string
    province_desc?: string | null
    city_municipality_code?: string
    city_municipality_desc?: string | null
    brgy_code?: string
    brgy_desc?: string | null
    status?: string
}

type ObjectPayloadValues = {
    description?: string
    chart_account_code?: string
    chart_account_desc?: string | null
    sub_object_code?: string
    sub_object_desc?: string | null
    status?: string
}

function normalizeFundingPayload(values: FundingPayloadValues) {
    return {
        description: values.description ?? '',
        cluster_code: values.cluster_code ?? '',
        cluster_desc: values.cluster_desc ?? null,
        financing_code: values.financing_code ?? '',
        financing_desc: values.financing_desc ?? null,
        auth_code: values.auth_code ?? '',
        auth_desc: values.auth_desc ?? null,
        category_code: values.category_code ?? '',
        category_desc: values.category_desc ?? null,
        status: (values.status ?? 'active') as 'active' | 'inactive',
    }
}

function normalizeLocationPayload(values: LocationPayloadValues) {
    return {
        description: values.description ?? '',
        region_code: values.region_code ?? '',
        region_desc: values.region_desc ?? null,
        province_code: values.province_code ?? '',
        province_desc: values.province_desc ?? null,
        city_municipality_code: values.city_municipality_code ?? '',
        city_municipality_desc: values.city_municipality_desc ?? null,
        brgy_code: values.brgy_code ?? '',
        brgy_desc: values.brgy_desc ?? null,
        status: (values.status ?? 'active') as 'active' | 'inactive',
    }
}

function normalizeObjectPayload(values: ObjectPayloadValues) {
    return {
        description: values.description ?? '',
        chart_account_code: values.chart_account_code ?? '',
        chart_account_desc: values.chart_account_desc ?? null,
        sub_object_code: values.sub_object_code ?? '',
        sub_object_desc: values.sub_object_desc ?? null,
        status: (values.status ?? 'active') as 'active' | 'inactive',
    }
}

function buildFundingValues(formData: FormData) {
    return {
        description: emptyToUndefined(formData.get('description')),
        cluster_code: emptyToUndefined(formData.get('cluster_code')),
        cluster_desc: emptyToUndefined(formData.get('cluster_desc')),
        financing_code: emptyToUndefined(formData.get('financing_code')),
        financing_desc: emptyToUndefined(formData.get('financing_desc')),
        auth_code: emptyToUndefined(formData.get('auth_code')),
        auth_desc: emptyToUndefined(formData.get('auth_desc')),
        category_code: emptyToUndefined(formData.get('category_code')),
        category_desc: emptyToUndefined(formData.get('category_desc')),
        status: emptyToUndefined(formData.get('status')) ?? 'active',
    }
}

function buildLocationValues(formData: FormData) {
    return {
        description: emptyToUndefined(formData.get('description')),
        region_code: emptyToUndefined(formData.get('region_code')),
        region_desc: emptyToUndefined(formData.get('region_desc')),
        province_code: emptyToUndefined(formData.get('province_code')),
        province_desc: emptyToUndefined(formData.get('province_desc')),
        city_municipality_code: emptyToUndefined(formData.get('city_municipality_code')),
        city_municipality_desc: emptyToUndefined(formData.get('city_municipality_desc')),
        brgy_code: emptyToUndefined(formData.get('brgy_code')),
        brgy_desc: emptyToUndefined(formData.get('brgy_desc')),
        status: emptyToUndefined(formData.get('status')) ?? 'active',
    }
}

function buildObjectValues(formData: FormData) {
    return {
        description: emptyToUndefined(formData.get('description')),
        chart_account_code: emptyToUndefined(formData.get('chart_account_code')),
        chart_account_desc: emptyToUndefined(formData.get('chart_account_desc')),
        sub_object_code: emptyToUndefined(formData.get('sub_object_code')),
        sub_object_desc: emptyToUndefined(formData.get('sub_object_desc')),
        status: emptyToUndefined(formData.get('status')) ?? 'active',
    }
}

function getChangedKeys<T extends Record<string, unknown>>(current: T, next: T) {
    return Object.keys(next).filter((key) => current[key as keyof T] !== next[key as keyof T])
}

function inferFundingScope(current: ReturnType<typeof normalizeFundingPayload>, next: ReturnType<typeof normalizeFundingPayload>, requestedScope: FundingSourceScope): FundingSourceScope {
    if (requestedScope !== 'record') return requestedScope

    const changed = getChangedKeys(current, next)
    if (changed.length === 0) return 'record'

    const isOnly = (keys: string[]) => changed.every((key) => keys.includes(key))

    if (isOnly(['cluster_code', 'cluster_desc'])) return 'cluster'
    if (isOnly(['financing_code', 'financing_desc'])) return 'financing'
    if (isOnly(['auth_code', 'auth_desc'])) return 'auth'

    return 'record'
}

function inferLocationScope(current: ReturnType<typeof normalizeLocationPayload>, next: ReturnType<typeof normalizeLocationPayload>, requestedScope: LocationScope): LocationScope {
    if (requestedScope !== 'record') return requestedScope

    const changed = getChangedKeys(current, next)
    if (changed.length === 0) return 'record'

    const isOnly = (keys: string[]) => changed.every((key) => keys.includes(key))

    if (isOnly(['region_code', 'region_desc'])) return 'region'
    if (isOnly(['province_code', 'province_desc'])) return 'province'
    if (isOnly(['city_municipality_code', 'city_municipality_desc'])) return 'city_municipality'

    return 'record'
}

function inferObjectScope(current: ReturnType<typeof normalizeObjectPayload>, next: ReturnType<typeof normalizeObjectPayload>, requestedScope: ObjectCodeScope): ObjectCodeScope {
    if (requestedScope !== 'record') return requestedScope

    const changed = getChangedKeys(current, next)
    if (changed.length === 0) return 'record'

    const isOnly = (keys: string[]) => changed.every((key) => keys.includes(key))

    if (isOnly(['chart_account_code', 'chart_account_desc'])) return 'chart_account'

    return 'record'
}

export async function loadUacsDashboard() {
    await requireDbm()

    const [fundingSources, locations, objectCodes] = await Promise.all([
        UacsRepository.listFundingSources(),
        UacsRepository.listLocations(),
        UacsRepository.listObjectCodes(),
    ])

    return { fundingSources, locations, objectCodes }
}

export async function createUacsCodeAction(state: UacsFormState, formData: FormData): Promise<UacsFormState> {
    await requireDbm()

    const category = UacsCategorySchema.parse(formData.get('category'))

    try {
        if (category === 'funding_source') {
            const values = normalizeFundingPayload(buildFundingValues(formData))
            const parsed = FundingSourceSchema.safeParse(values)
            if (!parsed.success) return flatten(parsed, toStateValues(values))
            await UacsRepository.createFundingSource(normalizeFundingPayload(parsed.data))
        } else if (category === 'location') {
            const values = normalizeLocationPayload(buildLocationValues(formData))
            const parsed = LocationSchema.safeParse(values)
            if (!parsed.success) return flatten(parsed, toStateValues(values))
            await UacsRepository.createLocation(normalizeLocationPayload(parsed.data))
        } else {
            const values = normalizeObjectPayload(buildObjectValues(formData))
            const parsed = ObjectCodeSchema.safeParse(values)
            if (!parsed.success) return flatten(parsed, toStateValues(values))
            await UacsRepository.createObjectCode(normalizeObjectPayload(parsed.data))
        }
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to create UACS code.'],
        }
    }

    revalidatePath('/dbm/uacs')
    redirect('/dbm/uacs')
}

export async function updateUacsCodeAction(state: UacsFormState, formData: FormData): Promise<UacsFormState> {
    await requireDbm()

    const category = UacsCategorySchema.parse(formData.get('category'))
    const code = z.string().min(1).parse(formData.get('code'))

    try {
        if (category === 'funding_source') {
            const current = await UacsRepository.getFundingSourceByCode(code)
            if (!current) return { formErrors: ['Funding source not found.'] }
            const values = normalizeFundingPayload(mergeDefined(current, buildFundingValues(formData)))
            const requestedScope = FundingSourceScopeSchema.parse(formData.get('scope'))
            const scope = inferFundingScope(normalizeFundingPayload(current), values, requestedScope)
            const parsed = FundingSourceSchema.safeParse(values)
            if (!parsed.success) return flatten(parsed, toStateValues({ ...values, scope }))
            await UacsRepository.updateFundingSourceCascade(code, normalizeFundingPayload(parsed.data), scope)
        } else if (category === 'location') {
            const current = await UacsRepository.getLocationByCode(code)
            if (!current) return { formErrors: ['Location not found.'] }
            const values = normalizeLocationPayload(mergeDefined(current, buildLocationValues(formData)))
            const requestedScope = LocationScopeSchema.parse(formData.get('scope'))
            const scope = inferLocationScope(normalizeLocationPayload(current), values, requestedScope)
            const parsed = LocationSchema.safeParse(values)
            if (!parsed.success) return flatten(parsed, toStateValues({ ...values, scope }))
            await UacsRepository.updateLocationCascade(code, normalizeLocationPayload(parsed.data), scope)
        } else {
            const current = await UacsRepository.getObjectCodeByCode(code)
            if (!current) return { formErrors: ['Object code not found.'] }
            const values = normalizeObjectPayload(mergeDefined(current, buildObjectValues(formData)))
            const requestedScope = ObjectCodeScopeSchema.parse(formData.get('scope'))
            const scope = inferObjectScope(normalizeObjectPayload(current), values, requestedScope)
            const parsed = ObjectCodeSchema.safeParse(values)
            if (!parsed.success) return flatten(parsed, toStateValues({ ...values, scope }))
            await UacsRepository.updateObjectCodeCascade(code, normalizeObjectPayload(parsed.data), scope)
        }
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to update UACS code.'],
        }
    }

    revalidatePath('/dbm/uacs')
    redirect('/dbm/uacs')
}

export async function inactivateUacsCodeAction(state: UacsFormState, formData: FormData): Promise<UacsFormState> {
    await requireDbm()

    const category = UacsCategorySchema.parse(formData.get('category'))
    const code = z.string().min(1).parse(formData.get('code'))

    try {
        if (category === 'funding_source') {
            const scope = FundingSourceScopeSchema.parse(formData.get('scope'))
            await UacsRepository.inactivateFundingSource(code, scope)
        } else if (category === 'location') {
            const scope = LocationScopeSchema.parse(formData.get('scope'))
            await UacsRepository.inactivateLocation(code, scope)
        } else {
            const scope = ObjectCodeScopeSchema.parse(formData.get('scope'))
            await UacsRepository.inactivateObjectCode(code, scope)
        }
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to inactivate UACS code.'],
        }
    }

    revalidatePath('/dbm/uacs')
    redirect('/dbm/uacs')
}

export async function loadUacsRecord(category: UacsCategory, code: string) {
    await requireDbm()

    if (category === 'funding_source') {
        return await UacsRepository.getFundingSourceByCode(code)
    }
    if (category === 'location') {
        return await UacsRepository.getLocationByCode(code)
    }
    return await UacsRepository.getObjectCodeByCode(code)
}
