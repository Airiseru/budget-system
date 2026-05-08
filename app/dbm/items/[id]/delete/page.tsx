import { notFound } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import { DeleteItemCatalogForm } from '@/components/ui/dbm/DeleteItemCatalogForm'
import { loadItemRecord } from '@/src/actions/items'

export default async function DeleteItemCatalogPage({
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
                    <h1 className="text-3xl font-bold tracking-tight">Delete Item Catalog Entry</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {record.record.name}
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <DeleteItemCatalogForm
                itemId={record.record.id}
                itemName={record.record.name}
            />
        </main>
    )
}
