import { notFound } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import { loadUacsRecord } from '@/src/actions/uacs'
import { InactivateUacsForm } from '@/components/ui/dbm/InactivateUacsForm'
import { UACS_CATEOGIRES, VALID_UACS_CATEGORIES } from '@/src/lib/constants'

export default async function InactivateUacsPage({
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
                    <h1 className="text-3xl font-bold tracking-tight">Set UACS Code Inactive</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Choose whether to inactivate only this record or its branch.
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <InactivateUacsForm
                category={category as UACS_CATEOGIRES}
                code={record.code}
                description={record.description}
            />
        </main>
    )
}
