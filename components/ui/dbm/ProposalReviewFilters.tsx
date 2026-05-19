'use client'

import { useState } from 'react'
import Link from 'next/link'
import SearchableComboboxField, { type SearchableComboboxOption } from './SearchableComboboxField'

type EntitySegment = {
    id: string
    name: string
    uacs_code: string
}

type Props = {
    viewingYear?: number
    availableYears: number[]
    selectedStatus: string
    selectedDepartmentId: string
    selectedAgencyId: string
    selectedOperatingUnitId: string
    search: string
    departments: EntitySegment[]
    agencies: EntitySegment[]
    operatingUnits: EntitySegment[]
    statusOptions: SearchableComboboxOption[]
}

function entityOptions(allLabel: string, entities: EntitySegment[]): SearchableComboboxOption[] {
    return [
        { value: 'all', label: allLabel },
        ...entities.map((entity) => ({
            value: entity.id,
            label: `${entity.uacs_code} - ${entity.name}`,
        })),
    ]
}

export default function ProposalReviewFilters({
    viewingYear,
    availableYears,
    selectedStatus,
    selectedDepartmentId,
    selectedAgencyId,
    selectedOperatingUnitId,
    search,
    departments,
    agencies,
    operatingUnits,
    statusOptions,
}: Props) {
    const [year, setYear] = useState(viewingYear ? String(viewingYear) : '')
    const [status, setStatus] = useState(selectedStatus || 'all')
    const [departmentId, setDepartmentId] = useState(selectedDepartmentId || 'all')
    const [agencyId, setAgencyId] = useState(selectedAgencyId || 'all')
    const [operatingUnitId, setOperatingUnitId] = useState(selectedOperatingUnitId || 'all')

    const yearOptions = availableYears.map((availableYear) => ({
        value: String(availableYear),
        label: `FY ${availableYear}`,
    }))

    return (
        <form method="get" className="rounded-lg border border-border bg-background p-4">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="departmentId" value={departmentId} />
            <input type="hidden" name="agencyId" value={agencyId} />
            <input type="hidden" name="operatingUnitId" value={operatingUnitId} />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <label className="space-y-1 text-sm font-medium">
                    <span>Fiscal Year</span>
                    <SearchableComboboxField
                        items={yearOptions}
                        value={year}
                        onValueChange={setYear}
                        placeholder="Select year"
                        searchPlaceholder="Search years"
                        emptyText="No years found."
                    />
                </label>
                <label className="space-y-1 text-sm font-medium">
                    <span>Status</span>
                    <SearchableComboboxField
                        items={statusOptions}
                        value={status}
                        onValueChange={setStatus}
                        placeholder="Select status"
                        searchPlaceholder="Search statuses"
                        emptyText="No statuses found."
                    />
                </label>
                <label className="space-y-1 text-sm font-medium">
                    <span>Department</span>
                    <SearchableComboboxField
                        items={entityOptions('All departments', departments)}
                        value={departmentId}
                        onValueChange={setDepartmentId}
                        placeholder="Select department"
                        searchPlaceholder="Search departments"
                        emptyText="No departments found."
                    />
                </label>
                <label className="space-y-1 text-sm font-medium">
                    <span>Agency</span>
                    <SearchableComboboxField
                        items={entityOptions('All agencies', agencies)}
                        value={agencyId}
                        onValueChange={setAgencyId}
                        placeholder="Select agency"
                        searchPlaceholder="Search agencies"
                        emptyText="No agencies found."
                    />
                </label>
                <label className="space-y-1 text-sm font-medium">
                    <span>Operating Unit</span>
                    <SearchableComboboxField
                        items={entityOptions('All operating units', operatingUnits)}
                        value={operatingUnitId}
                        onValueChange={setOperatingUnitId}
                        placeholder="Select operating unit"
                        searchPlaceholder="Search operating units"
                        emptyText="No operating units found."
                    />
                </label>
                <label className="space-y-1 text-sm font-medium">
                    <span>Search</span>
                    <input
                        name="search"
                        defaultValue={search}
                        className="min-h-12 w-full rounded border border-border bg-background px-3 py-3 text-md"
                    />
                </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
                <button className="h-10 rounded bg-secondary-foreground px-4 py-2 text-sm font-semibold text-white">Apply Filters</button>
                <Link href="/dbm/proposals" className="flex h-10 items-center text-sm text-muted-foreground underline underline-offset-2">Clear</Link>
            </div>
        </form>
    )
}
