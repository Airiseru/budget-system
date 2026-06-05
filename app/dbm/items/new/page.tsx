import BackButton from '@/components/ui/BackButton'
import { ItemCatalogForm } from '@/components/ui/dbm/ItemCatalogForm'
import { loadItemDashboard } from '@/src/actions/items'

export default async function NewItemCatalogPage() {
    const { entities, paps, objectCodes } = await loadItemDashboard()

    return (
        <main className="m-6 max-w-3xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/items" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Create Item Catalog Entry</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Add a new general line item and optionally define a new object code.
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <ItemCatalogForm
                mode="create"
                entities={entities}
                paps={paps.map((pap) => ({
                    id: pap.id,
                    title: pap.title,
                    entity_id: pap.entity_id,
                    entity_name: pap.entity_name,
                }))}
                objectCodes={objectCodes}
            />
        </main>
    )
}
