import { db } from '../database'
import { ItemCatalog, ItemCatalogScope, ItemCatalogUpdate, NewItemCatalog } from '@/src/types/line_items'
import { sql } from 'kysely'

export type ItemCatalogListItem = ItemCatalog & {
    object_code_description: string | null
    entity_name: string | null
    pap_title: string | null
}

export type ItemCatalogRecord = ItemCatalogListItem & {
    entity_type: string | null
}

export type ItemCatalogOption = ItemCatalogListItem

export type ItemCatalogFilters = {
    scope?: ItemCatalogScope
    entity_id?: string
    expense_class?: ItemCatalog['expense_class']
    limit?: number
    offset?: number
}

function itemCatalogBaseQuery() {
    return db
        .selectFrom('item_catalog')
        .leftJoin('uacs_object_codes', 'uacs_object_codes.code', 'item_catalog.uacs_obj_code')
        .leftJoin('entities', 'entities.id', 'item_catalog.entity_id')
        .leftJoin('departments', 'departments.id', 'entities.id')
        .leftJoin('agencies', 'agencies.id', 'entities.id')
        .leftJoin('operating_units', 'operating_units.id', 'entities.id')
        .leftJoin('paps', 'paps.id', 'item_catalog.pap_code')
}

export async function listItemCatalog(filters: ItemCatalogFilters = {}) {
    let query = itemCatalogBaseQuery()
        .selectAll('item_catalog')
        .select([
            'uacs_object_codes.description as object_code_description',
            'paps.title as pap_title',
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
        ])

    if (filters.scope) {
        query = query.where('item_catalog.scope', '=', filters.scope)
    }

    if (filters.entity_id) {
        query = query.where('item_catalog.entity_id', '=', filters.entity_id)
    }

    if (filters.expense_class) {
        query = query.where('item_catalog.expense_class', '=', filters.expense_class)
    }

    const allItems = await query
        .orderBy('item_catalog.updated_at', 'desc')
        .execute() as ItemCatalogListItem[]

    const totalCount = allItems.length
    const limit = filters.limit ?? 15
    const offset = filters.offset ?? 0

    return {
        items: allItems.slice(offset, offset + limit),
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
    }
}

export async function getItemCatalogById(id: string) {
    return await itemCatalogBaseQuery()
        .selectAll('item_catalog')
        .select([
            'uacs_object_codes.description as object_code_description',
            'paps.title as pap_title',
            'entities.type as entity_type',
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
        ])
        .where('item_catalog.id', '=', id)
        .executeTakeFirst() as ItemCatalogRecord | undefined
}

export async function listAllItemCatalog() {
    return await itemCatalogBaseQuery()
        .selectAll('item_catalog')
        .select([
            'uacs_object_codes.description as object_code_description',
            'paps.title as pap_title',
            sql<string | null>`COALESCE(departments.name, agencies.name, operating_units.name)`.as('entity_name'),
        ])
        .orderBy('item_catalog.name', 'asc')
        .execute() as ItemCatalogOption[]
}

export async function createItemCatalog(item: NewItemCatalog) {
    return await db
        .insertInto('item_catalog')
        .values(item)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function updateItemCatalog(id: string, item: ItemCatalogUpdate) {
    await db
        .updateTable('item_catalog')
        .set({
            ...item,
            updated_at: new Date(),
        })
        .where('id', '=', id)
        .executeTakeFirstOrThrow()

    return await getItemCatalogById(id)
}

export async function deleteItemCatalog(id: string) {
    return await db
        .deleteFrom('item_catalog')
        .where('id', '=', id)
        .executeTakeFirst()
}
