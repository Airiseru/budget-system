import { ItemCatalogTable } from '@/components/ui/dbm/ItemCatalogTable'
import { createEntityRepository, createItemRepository } from '@/src/db/factory'
import type { ItemCatalogScope, ExpenseClass } from '@/src/types/line_items'

export const dynamic = 'force-dynamic'

const ItemRepository = createItemRepository(process.env.DATABASE_TYPE || 'postgres')
const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

type ItemsSearchParams = Promise<{
    page?: string
    scope?: string
    entityId?: string
    expenseClass?: string
}>

export default async function DbmItemsPage({ searchParams }: { searchParams: ItemsSearchParams }) {
    const params = await searchParams
    const page = Number(params.page) || 1
    const limit = 15
    const offset = (page - 1) * limit
    const selectedScope = params.scope || ''
    const selectedEntityId = params.entityId || ''
    const selectedExpenseClass = params.expenseClass || ''

    const [itemCatalog, entitySegments] = await Promise.all([
        ItemRepository.listItemCatalog({
            scope: selectedScope ? selectedScope as ItemCatalogScope : undefined,
            entity_id: selectedEntityId || undefined,
            expense_class: selectedExpenseClass ? selectedExpenseClass as ExpenseClass : undefined,
            limit,
            offset,
        }),
        EntityRepository.getAllEntitySegments(true),
    ])

    const entities = [
        ...entitySegments.departments,
        ...entitySegments.agencies,
        ...entitySegments.operatingUnits,
    ]

    return (
        <ItemCatalogTable
            items={itemCatalog.items}
            entities={entities}
            page={page}
            totalPages={itemCatalog.totalPages}
            selectedScope={selectedScope}
            selectedEntityId={selectedEntityId}
            selectedExpenseClass={selectedExpenseClass}
        />
    )
}
