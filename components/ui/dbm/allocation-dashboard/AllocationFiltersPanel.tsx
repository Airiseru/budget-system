'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SearchableComboboxField, { type SearchableComboboxOption } from '@/components/ui/dbm/SearchableComboboxField'
import type { Department } from '@/src/types/entities'
import type { PapOption } from '@/src/db/postgres/repositories/papRepository'
import { EXPENSE_CLASSES } from '@/src/lib/constants'

type Props = {
    open: boolean
    onToggle: () => void
    availableYears: number[]
    yearLockedToActivePreparation: boolean
    selectedYear: string
    onSelectedYearChange: (value: string) => void
    departments: Department[]
    departmentId: string
    onDepartmentIdChange: (value: string) => void
    paps: PapOption[]
    papId: string
    onPapIdChange: (value: string) => void
    expenseClass: string
    onExpenseClassChange: (value: string) => void
    searchValue: string
    onSearchValueChange: (value: string) => void
    showUacs: boolean
    onShowUacsChange: (value: boolean) => void
    showRejectedPaps: boolean
    onShowRejectedPapsChange: (value: boolean) => void
    onSubmit: () => void
    clearHref: string
}

export default function AllocationFiltersPanel({
    open,
    onToggle,
    availableYears,
    yearLockedToActivePreparation,
    selectedYear,
    onSelectedYearChange,
    departments,
    departmentId,
    onDepartmentIdChange,
    paps,
    papId,
    onPapIdChange,
    expenseClass,
    onExpenseClassChange,
    searchValue,
    onSearchValueChange,
    showUacs,
    onShowUacsChange,
    showRejectedPaps,
    onShowRejectedPapsChange,
    onSubmit,
    clearHref,
}: Props) {
    const sortedDepartments = [...departments].sort((a, b) =>
        (a.uacs_code ?? '').localeCompare(b.uacs_code ?? '')
    )
    const sortedPaps = [...paps].sort((a, b) => a.title.localeCompare(b.title))
    const yearOptions: SearchableComboboxOption[] = availableYears.map((year) => ({
        value: String(year),
        label: `FY ${year}`,
    }))
    const departmentOptions: SearchableComboboxOption[] = [
        { value: 'all', label: 'All departments' },
        ...sortedDepartments.map((department) => ({
            value: department.id,
            label: department.name,
        })),
    ]
    const papOptions: SearchableComboboxOption[] = [
        { value: 'all', label: 'All PAPs' },
        ...sortedPaps.map((pap) => ({
            value: pap.id,
            label: pap.entity_name ? `${pap.title} • ${pap.entity_name}` : `${pap.title} • All entities`,
        })),
    ]
    const expenseClassOptions: SearchableComboboxOption[] = [
        { value: 'all', label: 'All expense classes' },
        ...Object.entries(EXPENSE_CLASSES).map(([code, label]) => ({
            value: code,
            label: `${code} • ${label}`,
        })),
    ]

    return (
        <section className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm">
            <button
                type="button"
                onClick={onToggle}
                className={`flex w-full items-center justify-between px-4 py-4 text-left ${open ? 'border-b border-border' : ''}`}
            >
                <div>
                    <h2 className="text-lg font-semibold text-secondary-foreground">Filters</h2>
                    <p className="text-sm text-muted-foreground">
                        Narrow the allocation table by year, department, PAP, expense class, or line item name.
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
                        onSubmit()
                    }}
                    className="flex flex-col gap-4 px-4 py-4"
                >
                    <div className="grid gap-4 xl:grid-cols-5">
                        <div className="space-y-2">
                            <p className="font-medium">Year</p>
                            <SearchableComboboxField
                                items={yearOptions}
                                value={selectedYear}
                                onValueChange={onSelectedYearChange}
                                placeholder="Select year"
                                searchPlaceholder="Search year"
                                emptyText="No years found."
                                disabled={yearLockedToActivePreparation}
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Department</p>
                            <SearchableComboboxField
                                items={departmentOptions}
                                value={departmentId || 'all'}
                                onValueChange={(value) => onDepartmentIdChange(value || 'all')}
                                placeholder="All departments"
                                searchPlaceholder="Search departments"
                                emptyText="No departments found."
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">PAP</p>
                            <SearchableComboboxField
                                items={papOptions}
                                value={papId || 'all'}
                                onValueChange={(value) => onPapIdChange(value || 'all')}
                                placeholder="All PAPs"
                                searchPlaceholder="Search PAPs"
                                emptyText="No PAPs found."
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Expense Class</p>
                            <SearchableComboboxField
                                items={expenseClassOptions}
                                value={expenseClass || 'all'}
                                onValueChange={(value) => onExpenseClassChange(value || 'all')}
                                placeholder="All expense classes"
                                searchPlaceholder="Search expense class"
                                emptyText="No expense classes found."
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="font-medium">Search Item</p>
                            <input
                                value={searchValue}
                                onChange={(event) => onSearchValueChange(event.target.value)}
                                className="h-auto min-h-12 w-full rounded-md border border-border bg-background px-3 py-3 text-md"
                                placeholder="Search item catalog name"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button type="submit" className="bg-accent-foreground text-white hover:bg-accent-foreground/90">
                                Apply Filters
                            </Button>
                            <Link
                                href={clearHref}
                                className="flex h-9 items-center text-sm text-muted-foreground underline underline-offset-2 hover:text-secondary-foreground"
                            >
                                Clear
                            </Link>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={showUacs}
                                    onChange={(event) => onShowUacsChange(event.target.checked)}
                                />
                                Show UACS
                            </label>
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={showRejectedPaps}
                                    onChange={(event) => onShowRejectedPapsChange(event.target.checked)}
                                />
                                Include rejected PAPs
                            </label>
                        </div>
                    </div>
                </form>
            ) : null}
        </section>
    )
}
