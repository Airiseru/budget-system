'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SearchableComboboxField, { type SearchableComboboxOption } from '@/components/ui/dbm/SearchableComboboxField'
import { PAP_PROJECT_STATUS_LABELS, type PAP_PROJECT_STATUS_TYPES } from '@/src/lib/constants'

const FORM_TYPE_OPTIONS: SearchableComboboxOption[] = [
    { value: 'all', label: 'All form types' },
    { value: '202', label: 'BP Form 202 (Local)' },
    { value: '203', label: 'BP Form 203 (Foreign)' },
]

const PROJECT_STATUS_OPTIONS: SearchableComboboxOption[] = [
    { value: 'all', label: 'All project statuses' },
    ...Object.entries(PAP_PROJECT_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
    })),
]

type Props = {
    search: string
    formType: string
    status: PAP_PROJECT_STATUS_TYPES | 'all'
}

export default function PapFilters({ search, formType, status }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(true)
    const [searchValue, setSearchValue] = useState(search)
    const [selectedFormType, setSelectedFormType] = useState(formType || 'all')
    const [selectedStatus, setSelectedStatus] = useState<PAP_PROJECT_STATUS_TYPES | 'all'>(status)
    const hasFilters = Boolean(search || formType || status !== 'approved')

    const applyFilters = () => {
        const next = new URLSearchParams()
        const cleanSearch = searchValue.trim()

        if (cleanSearch) next.set('search', cleanSearch)
        if (selectedFormType !== 'all') next.set('formType', selectedFormType)
        if (selectedStatus !== 'approved') next.set('status', selectedStatus)

        const query = next.toString()
        router.push(query ? `/paps?${query}` : '/paps')
    }

    return (
        <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className={`flex w-full items-center justify-between gap-4 px-4 py-4 text-left ${open ? 'border-b border-border' : ''}`}
            >
                <div>
                    <h2 className="text-lg font-semibold text-secondary-foreground">Filters</h2>
                    <p className="text-sm text-muted-foreground">
                        Narrow PAP records by form type or by searching PAP names, descriptions, beneficiaries, and codes.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{open ? 'Hide' : 'Show'}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {open ? (
                <form
                    onSubmit={(event) => {
                        event.preventDefault()
                        applyFilters()
                    }}
                    className="flex flex-col gap-4 px-4 py-4"
                >
                    <div className="grid gap-4 xl:grid-cols-[minmax(260px,1fr)_260px_260px]">
                        <div className="space-y-2">
                            <p className="font-medium">Search PAP</p>
                            <input
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.target.value)}
                                placeholder="Search PAP name, description, or code"
                                className="h-auto min-h-12 w-full rounded-md border border-border bg-background px-3 py-3 text-md"
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="font-medium">Form Type</p>
                            <SearchableComboboxField
                                items={FORM_TYPE_OPTIONS}
                                value={selectedFormType}
                                onValueChange={(value) => setSelectedFormType(value || 'all')}
                                placeholder="All form types"
                                searchPlaceholder="Search form type"
                                emptyText="No form types found."
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="font-medium">Project Status</p>
                            <SearchableComboboxField
                                items={PROJECT_STATUS_OPTIONS}
                                value={selectedStatus}
                                onValueChange={(value) => setSelectedStatus((value || 'approved') as PAP_PROJECT_STATUS_TYPES | 'all')}
                                placeholder="Approved"
                                searchPlaceholder="Search project status"
                                emptyText="No statuses found."
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button type="submit" className="bg-accent-foreground text-white hover:bg-accent-foreground/90">
                            Apply Filters
                        </Button>
                        {hasFilters && (
                            <Link
                                href="/paps"
                                className="flex h-9 items-center text-sm text-muted-foreground underline underline-offset-2 hover:text-secondary-foreground"
                            >
                                Clear
                            </Link>
                        )}
                    </div>
                </form>
            ) : null}
        </section>
    )
}
