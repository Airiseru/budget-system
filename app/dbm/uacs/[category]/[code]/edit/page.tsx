import { notFound } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import { loadUacsRecord } from '@/src/actions/uacs'
import { UacsForm } from '@/components/ui/dbm/UacsForm'
import { UACS_CATEOGIRES, VALID_UACS_CATEGORIES } from '@/src/lib/constants'

export default async function EditUacsPage({
    params,
}: {
    params: Promise<{ category: string; code: string }>
}) {
    const { category, code } = await params
    if (!VALID_UACS_CATEGORIES.includes(category as UACS_CATEOGIRES)) notFound()

    const record = await loadUacsRecord(category as UACS_CATEOGIRES, decodeURIComponent(code))
    if (!record) notFound()

    return (
        <main className="m-6 max-w-3xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/uacs" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Edit UACS Code</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {record.code}
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <UacsForm
                category={category as UACS_CATEOGIRES}
                mode="edit"
                code={record.code}
                initialValues={Object.fromEntries(
                    Object.entries(record).map(([key, value]) => [key, value == null ? '' : String(value)])
                )}
            />
        </main>
    )
}
