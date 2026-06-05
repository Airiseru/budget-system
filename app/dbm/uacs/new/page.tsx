import { redirect } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import { UacsForm } from '@/components/ui/dbm/UacsForm'
import { VALID_UACS_CATEGORIES } from '@/src/lib/constants'

export default async function NewUacsPage({
    searchParams,
}: {
    searchParams?: Promise<{ category?: string }>
}) {
    const params = await searchParams
    const category = VALID_UACS_CATEGORIES.includes((params?.category ?? '') as typeof VALID_UACS_CATEGORIES[number])
        ? (params?.category as typeof VALID_UACS_CATEGORIES[number])
        : 'funding_source'

    if (!category) redirect('/dbm/uacs')

    return (
        <main className="m-6 max-w-3xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/uacs" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Create UACS Code</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Add a new {category.replace('_', ' ')} record.
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <UacsForm category={category} mode="create" />
        </main>
    )
}
