import { ExpressionBuilder, sql } from 'kysely'
import { db } from '../database'
import { UACS_CATEOGIRES } from '@/src/lib/constants'
import {
    UacsFundingSourceTable,
    UacsLocationsTable,
    UacsObjectCodesTable,
    UacsStatusType,
} from '@/src/types/uacs'
import { Database } from '@/src/types'

export type FundingSourceScope = 'record' | 'cluster' | 'financing' | 'auth'
export type LocationScope = 'record' | 'region' | 'province' | 'city_municipality'
export type ObjectCodeScope = 'record' | 'chart_account'
export type UacsCategory = 'funding_source' | 'location' | 'object_code'
export type UacsScope = FundingSourceScope | LocationScope | ObjectCodeScope

export type FundingSourceInput = Omit<UacsFundingSourceTable, 'created_at' | 'updated_at'>
export type LocationInput = Omit<UacsLocationsTable, 'created_at' | 'updated_at'>
export type ObjectCodeInput = Omit<UacsObjectCodesTable, 'created_at' | 'updated_at'>

function fundingCode(input: Pick<FundingSourceInput, 'cluster_code' | 'financing_code' | 'auth_code' | 'category_code'>) {
    return `${input.cluster_code}${input.financing_code}${input.auth_code}${input.category_code}`
}

function locationCode(input: Pick<LocationInput, 'region_code' | 'province_code' | 'city_municipality_code' | 'brgy_code'>) {
    return `${input.region_code}${input.province_code}${input.city_municipality_code}${input.brgy_code}`
}

function objectCode(input: Pick<ObjectCodeInput, 'chart_account_code' | 'sub_object_code'>) {
    return `${input.chart_account_code}${input.sub_object_code}`
}

function applyFundingScope(
    row: FundingSourceInput,
    next: Omit<FundingSourceInput, 'code'>,
    scope: FundingSourceScope
): FundingSourceInput {
    if (scope === 'cluster') {
        return {
            ...row,
            cluster_code: next.cluster_code,
            cluster_desc: next.cluster_desc,
            status: next.status,
            code: fundingCode({
                cluster_code: next.cluster_code,
                financing_code: row.financing_code,
                auth_code: row.auth_code,
                category_code: row.category_code,
            }),
        }
    }

    if (scope === 'financing') {
        return {
            ...row,
            financing_code: next.financing_code,
            financing_desc: next.financing_desc,
            status: next.status,
            code: fundingCode({
                cluster_code: row.cluster_code,
                financing_code: next.financing_code,
                auth_code: row.auth_code,
                category_code: row.category_code,
            }),
        }
    }

    if (scope === 'auth') {
        return {
            ...row,
            auth_code: next.auth_code,
            auth_desc: next.auth_desc,
            status: next.status,
            code: fundingCode({
                cluster_code: row.cluster_code,
                financing_code: row.financing_code,
                auth_code: next.auth_code,
                category_code: row.category_code,
            }),
        }
    }

    return {
        ...row,
        ...next,
        code: fundingCode(next),
    }
}

function applyLocationScope(
    row: LocationInput,
    next: Omit<LocationInput, 'code'>,
    scope: LocationScope
): LocationInput {
    if (scope === 'region') {
        return {
            ...row,
            region_code: next.region_code,
            region_desc: next.region_desc,
            status: next.status,
            code: locationCode({
                region_code: next.region_code,
                province_code: row.province_code,
                city_municipality_code: row.city_municipality_code,
                brgy_code: row.brgy_code,
            }),
        }
    }

    if (scope === 'province') {
        return {
            ...row,
            province_code: next.province_code,
            province_desc: next.province_desc,
            status: next.status,
            code: locationCode({
                region_code: row.region_code,
                province_code: next.province_code,
                city_municipality_code: row.city_municipality_code,
                brgy_code: row.brgy_code,
            }),
        }
    }

    if (scope === 'city_municipality') {
        return {
            ...row,
            city_municipality_code: next.city_municipality_code,
            city_municipality_desc: next.city_municipality_desc,
            status: next.status,
            code: locationCode({
                region_code: row.region_code,
                province_code: row.province_code,
                city_municipality_code: next.city_municipality_code,
                brgy_code: row.brgy_code,
            }),
        }
    }

    return {
        ...row,
        ...next,
        code: locationCode(next),
    }
}

function applyObjectScope(
    row: ObjectCodeInput,
    next: Omit<ObjectCodeInput, 'code'>,
    scope: ObjectCodeScope
): ObjectCodeInput {
    if (scope === 'chart_account') {
        return {
            ...row,
            chart_account_code: next.chart_account_code,
            chart_account_desc: next.chart_account_desc,
            status: next.status,
            code: objectCode({
                chart_account_code: next.chart_account_code,
                sub_object_code: row.sub_object_code,
            }),
        }
    }

    return {
        ...row,
        ...next,
        code: objectCode(next),
    }
}

function fundingScopeFilter(
    eb: ExpressionBuilder<Database, 'uacs_funding_sources'>,
    source: FundingSourceInput,
    scope: FundingSourceScope
) {
    if (scope === 'cluster') {
        return eb('cluster_code', '=', source.cluster_code)
    }
    if (scope === 'financing') {
        return eb.and([
            eb('cluster_code', '=', source.cluster_code),
            eb('financing_code', '=', source.financing_code),
        ])
    }
    if (scope === 'auth') {
        return eb.and([
            eb('cluster_code', '=', source.cluster_code),
            eb('financing_code', '=', source.financing_code),
            eb('auth_code', '=', source.auth_code),
        ])
    }
    return eb('code', '=', source.code)
}

function locationScopeFilter(
    eb: ExpressionBuilder<Database, 'uacs_locations'>,
    source: LocationInput,
    scope: LocationScope
) {
    if (scope === 'region') {
        return eb('region_code', '=', source.region_code)
    }
    if (scope === 'province') {
        return eb.and([
            eb('region_code', '=', source.region_code),
            eb('province_code', '=', source.province_code),
        ])
    }
    if (scope === 'city_municipality') {
        return eb.and([
            eb('region_code', '=', source.region_code),
            eb('province_code', '=', source.province_code),
            eb('city_municipality_code', '=', source.city_municipality_code),
        ])
    }
    return eb('code', '=', source.code)
}

function objectScopeFilter(
    eb: ExpressionBuilder<Database, 'uacs_object_codes'>,
    source: ObjectCodeInput,
    scope: ObjectCodeScope
) {
    if (scope === 'chart_account') {
        return eb('chart_account_code', '=', source.chart_account_code)
    }
    return eb('code', '=', source.code)
}

export async function listFundingSources() {
    return await db
        .selectFrom('uacs_funding_sources')
        .selectAll()
        .orderBy('cluster_code', 'asc')
        .orderBy('financing_code', 'asc')
        .orderBy('auth_code', 'asc')
        .orderBy('category_code', 'asc')
        .execute()
}

export async function listLocations() {
    return await db
        .selectFrom('uacs_locations')
        .selectAll()
        .orderBy('region_code', 'asc')
        .orderBy('province_code', 'asc')
        .orderBy('city_municipality_code', 'asc')
        .orderBy('brgy_code', 'asc')
        .execute()
}

export async function listObjectCodes() {
    return await db
        .selectFrom('uacs_object_codes')
        .selectAll()
        .orderBy('chart_account_code', 'asc')
        .orderBy('sub_object_code', 'asc')
        .execute()
}

export async function getFundingSourceByCode(code: string) {
    return await db.selectFrom('uacs_funding_sources').selectAll().where('code', '=', code).executeTakeFirst()
}

export async function getLocationByCode(code: string) {
    return await db.selectFrom('uacs_locations').selectAll().where('code', '=', code).executeTakeFirst()
}

export async function getObjectCodeByCode(code: string) {
    return await db.selectFrom('uacs_object_codes').selectAll().where('code', '=', code).executeTakeFirst()
}

export async function createFundingSource(input: Omit<FundingSourceInput, 'code'>) {
    return await db
        .insertInto('uacs_funding_sources')
        .values({
            ...input,
            code: fundingCode(input),
        })
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function createLocation(input: Omit<LocationInput, 'code'>) {
    return await db
        .insertInto('uacs_locations')
        .values({
            ...input,
            code: locationCode(input),
        })
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function createObjectCode(input: Omit<ObjectCodeInput, 'code'>) {
    return await db
        .insertInto('uacs_object_codes')
        .values({
            ...input,
            code: objectCode(input),
        })
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function updateFundingSourceCascade(
    code: string,
    nextValues: Omit<FundingSourceInput, 'code'>,
    scope: FundingSourceScope
) {
    const current = await getFundingSourceByCode(code)
    if (!current) throw new Error('Funding source not found.')

    await db.transaction().execute(async (trx) => {
        const rows = await trx
            .selectFrom('uacs_funding_sources')
            .selectAll()
            .where((eb) => fundingScopeFilter(eb, current, scope))
            .execute()

        for (const row of rows) {
            const updated = applyFundingScope(row, nextValues, scope)
            await trx
                .updateTable('uacs_funding_sources')
                .set({
                    description: updated.description,
                    cluster_code: updated.cluster_code,
                    cluster_desc: updated.cluster_desc,
                    financing_code: updated.financing_code,
                    financing_desc: updated.financing_desc,
                    auth_code: updated.auth_code,
                    auth_desc: updated.auth_desc,
                    category_code: updated.category_code,
                    category_desc: updated.category_desc,
                    status: updated.status,
                    code: updated.code,
                    updated_at: sql`now()`,
                })
                .where('code', '=', row.code)
                .execute()
        }
    })
}

export async function updateLocationCascade(
    code: string,
    nextValues: Omit<LocationInput, 'code'>,
    scope: LocationScope
) {
    const current = await getLocationByCode(code)
    if (!current) throw new Error('Location not found.')

    await db.transaction().execute(async (trx) => {
        const rows = await trx
            .selectFrom('uacs_locations')
            .selectAll()
            .where((eb) => locationScopeFilter(eb, current, scope))
            .execute()

        for (const row of rows) {
            const updated = applyLocationScope(row, nextValues, scope)
            await trx
                .updateTable('uacs_locations')
                .set({
                    description: updated.description,
                    region_code: updated.region_code,
                    region_desc: updated.region_desc,
                    province_code: updated.province_code,
                    province_desc: updated.province_desc,
                    city_municipality_code: updated.city_municipality_code,
                    city_municipality_desc: updated.city_municipality_desc,
                    brgy_code: updated.brgy_code,
                    brgy_desc: updated.brgy_desc,
                    status: updated.status,
                    code: updated.code,
                    updated_at: sql`now()`,
                })
                .where('code', '=', row.code)
                .execute()
        }
    })
}

export async function updateObjectCodeCascade(
    code: string,
    nextValues: Omit<ObjectCodeInput, 'code'>,
    scope: ObjectCodeScope
) {
    const current = await getObjectCodeByCode(code)
    if (!current) throw new Error('Object code not found.')

    await db.transaction().execute(async (trx) => {
        const rows = await trx
            .selectFrom('uacs_object_codes')
            .selectAll()
            .where((eb) => objectScopeFilter(eb, current, scope))
            .execute()

        for (const row of rows) {
            const updated = applyObjectScope(row, nextValues, scope)
            await trx
                .updateTable('uacs_object_codes')
                .set({
                    description: updated.description,
                    chart_account_code: updated.chart_account_code,
                    chart_account_desc: updated.chart_account_desc,
                    sub_object_code: updated.sub_object_code,
                    sub_object_desc: updated.sub_object_desc,
                    status: updated.status,
                    code: updated.code,
                    updated_at: sql`now()`,
                })
                .where('code', '=', row.code)
                .execute()
        }
    })
}

export async function inactivateFundingSource(code: string, scope: FundingSourceScope) {
    const current = await getFundingSourceByCode(code)
    if (!current) throw new Error('Funding source not found.')

    await db
        .updateTable('uacs_funding_sources')
        .set({ status: 'inactive', updated_at: sql`now()` })
        .where((eb) => fundingScopeFilter(eb, current, scope))
        .execute()
}

export async function inactivateLocation(code: string, scope: LocationScope) {
    const current = await getLocationByCode(code)
    if (!current) throw new Error('Location not found.')

    await db
        .updateTable('uacs_locations')
        .set({ status: 'inactive', updated_at: sql`now()` })
        .where((eb) => locationScopeFilter(eb, current, scope))
        .execute()
}

export async function inactivateObjectCode(code: string, scope: ObjectCodeScope) {
    const current = await getObjectCodeByCode(code)
    if (!current) throw new Error('Object code not found.')

    await db
        .updateTable('uacs_object_codes')
        .set({ status: 'inactive', updated_at: sql`now()` })
        .where((eb) => objectScopeFilter(eb, current, scope))
        .execute()
}

export function getDefaultScopeForCategory(category: UACS_CATEOGIRES): UacsScope {
    if (category === 'funding_source') return 'record'
    if (category === 'location') return 'record'
    return 'record'
}

export function normalizeStatus(status: string | null | undefined): UacsStatusType {
    return status === 'inactive' ? 'inactive' : 'active'
}
