'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import SearchableComboboxField, { type SearchableComboboxOption } from './SearchableComboboxField'

type Props = {
    basePath: string
    departmentOptions: SearchableComboboxOption[]
    selectedDepartmentId: string
}

export default function EntityFilters({
    basePath,
    departmentOptions,
    selectedDepartmentId,
}: Props) {
    const router = useRouter()
    const options = [
        { value: 'all', label: 'All departments' },
        ...departmentOptions,
    ]

    function handleDepartmentChange(value: string) {
        const params = new URLSearchParams()
        if (value && value !== 'all') params.set('department', value)
        router.push(params.toString() ? `${basePath}?${params.toString()}` : basePath)
    }

    return (
        <section className="rounded-xl border border-border bg-accent p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="w-full max-w-xl space-y-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                        Department
                    </label>
                    <SearchableComboboxField
                        items={options}
                        value={selectedDepartmentId || 'all'}
                        onValueChange={handleDepartmentChange}
                        placeholder="All departments"
                        searchPlaceholder="Search departments"
                        emptyText="No departments found."
                    />
                </div>

                {selectedDepartmentId ? (
                    <Button type="button" variant="outline" onClick={() => router.push(basePath)}>
                        Clear
                    </Button>
                ) : null}
            </div>
        </section>
    )
}
