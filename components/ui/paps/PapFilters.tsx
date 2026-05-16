'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SearchableComboboxField, { type SearchableComboboxOption } from '@/components/ui/dbm/SearchableComboboxField'

const FORM_TYPE_OPTIONS: SearchableComboboxOption[] = [
    { value: 'all', label: 'All form types' },
    { value: '202', label: 'BP Form 202 (Local)' },
    { value: '203', label: 'BP Form 203 (Foreign)' },
]

type Props = {
    search: string
    formType: string
}

export default function PapFilters({ search, formType }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(true)
    const [searchValue, setSearchValue] = useState(search)
    const [selectedFormType, setSelectedFormType] = useState(formType || 'all')
    const hasFilters = Boolean(search || formType)

    const applyFilters = () => {
        const next = new URLSearchParams()
        const cleanSearch = searchValue.trim()

        if (cleanSearch) next.set('search', cleanSearch)
        if (selectedFormType !== 'all') next.set('formType', selectedFormType)

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
                    <div className="grid gap-4 xl:grid-cols-[minmax(260px,1fr)_260px]">
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
