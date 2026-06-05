import { notFound } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import { ItemCatalogForm } from '@/components/ui/dbm/ItemCatalogForm'
import { loadItemRecord } from '@/src/actions/items'

export default async function EditItemCatalogPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const record = await loadItemRecord(id)
    if (!record) notFound()

    return (
        <main className="m-6 max-w-3xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/items" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Edit Item Catalog Entry</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {record.record.name}
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <ItemCatalogForm
                mode="edit"
                entities={record.entities}
                paps={record.paps.map((pap) => ({
                    id: pap.id,
                    title: pap.title,
                    entity_id: pap.entity_id,
                    entity_name: pap.entity_name,
                }))}
                objectCodes={record.objectCodes}
                initialValues={record.record}
            />
        </main>
    )
}
