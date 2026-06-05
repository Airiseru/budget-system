'use client'

import BackButton from '@/components/ui/BackButton'
import PaginationControls from '@/components/ui/PaginationControls'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, type ReactNode, useState } from 'react'
import { ChevronRight, FileText, Filter } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { STATUS_COLOR_MAPPER, STATUS_LABELS } from '@/src/lib/constants'

export type EntityFormListRow = {
    id: string
    href: string
    title: string
    subtitle?: string
    entityLabel?: string
    groupLabel?: string
    fiscalYear: number
    status: string | null
    updatedAt: Date | string | null
    amountLabel?: string
    detailLabel?: string
    typeLabel?: string
}

type FilterOption = {
    value: string
    label: string
}

type Props = {
    title: string
    description: string
    basePath: string
    rows: EntityFormListRow[]
    page: number
    totalPages: number
    selectedYear?: number
    selectedStatus: string
    selectedType: string
    selectedEntityId?: string
    selectedSearch: string
    availableYears: number[]
    typeOptions?: FilterOption[]
    entityOptions?: FilterOption[]
    activeYear?: number
    phaseNotice?: ReactNode
    createActions?: ReactNode
    secondaryActions?: ReactNode
}

export default function EntityFormListView({
    title,
    description,
    basePath,
    rows,
    page,
    totalPages,
    selectedYear,
    selectedStatus,
    selectedType,
    selectedEntityId = '',
    selectedSearch,
    availableYears,
    typeOptions = [],
    entityOptions = [],
    activeYear,
    phaseNotice,
    createActions,
    secondaryActions,
}: Props) {
    const router = useRouter()
    const [year, setYear] = useState(selectedYear?.toString() ?? '')
    const [status, setStatus] = useState(selectedStatus)
    const [type, setType] = useState(selectedType)
    const [entityId, setEntityId] = useState(selectedEntityId)
    const [search, setSearch] = useState(selectedSearch)

    function buildHref(targetPage?: number) {
        const params = new URLSearchParams()
        if (!activeYear && year) params.set('year', year)
        if (status) params.set('status', status)
        if (type) params.set('type', type)
        if (entityId) params.set('entity', entityId)
        if (search.trim()) params.set('search', search.trim())
        if (targetPage && targetPage > 1) params.set('page', String(targetPage))
        const query = params.toString()
        return query ? `${basePath}?${query}` : basePath
    }

    function handleFilter(event: React.SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        router.push(buildHref())
    }

    return (
        <main className="m-6 mx-auto max-w-7xl space-y-6 px-4 py-10">
            <div className="flex items-center justify-between gap-4">
                <BackButton url="/home" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">{title}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                <div className="w-[73px]" />
            </div>

            {activeYear || phaseNotice ? (
                <div className="space-y-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3 text-sm text-primary-foreground">
                    {activeYear ? (
                        <p className="font-semibold">
                            Showing active FY {activeYear}. Year filtering is locked while the budget preparation cycle is active.
                        </p>
                    ) : null}
                    {phaseNotice ? (
                        <div className="font-medium text-primary-foreground/90">
                            {phaseNotice}
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="rounded-xl border border-border/30 bg-accent p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-secondary-foreground">Filters</h2>
                    <div className="flex flex-wrap gap-2">
                        {secondaryActions}
                        {createActions}
                    </div>
                </div>

                <form onSubmit={handleFilter} className="flex flex-col gap-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <div className="space-y-1">
                            <label htmlFor="year" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Fiscal Year</label>
                            <Select
                                value={activeYear ? String(activeYear) : year || 'all'}
                                onValueChange={(value) => setYear(value === 'all' ? '' : value ?? '')}
                                disabled={!!activeYear}
                            >
                                <SelectTrigger className="h-[38px] w-full border border-border/50 bg-accent text-secondary-foreground">
                                    <SelectValue placeholder="All years">
                                        {activeYear ? `FY ${activeYear}` : year ? `FY ${year}` : 'All years'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All years</SelectItem>
                                    {availableYears.map((optionYear) => (
                                        <SelectItem key={optionYear} value={String(optionYear)}>
                                            FY {optionYear}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="status" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Status</label>
                            <Select value={status || 'all'} onValueChange={(value) => setStatus(value === 'all' ? '' : value ?? '')}>
                                <SelectTrigger className="h-[38px] w-full border border-border/50 bg-accent text-secondary-foreground">
                                    <SelectValue placeholder="All statuses">
                                        {status ? STATUS_LABELS[status] ?? status : 'All statuses'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {typeOptions.length > 0 ? (
                            <div className="space-y-1">
                                <label htmlFor="type" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Type</label>
                                <Select value={type || 'all'} onValueChange={(value) => setType(value === 'all' ? '' : value ?? '')}>
                                    <SelectTrigger className="h-[38px] w-full border border-border/50 bg-accent text-secondary-foreground">
                                        <SelectValue placeholder="All types">
                                            {typeOptions.find((option) => option.value === type)?.label ?? 'All types'}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All types</SelectItem>
                                        {typeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}

                        {entityOptions.length > 0 ? (
                            <div className="space-y-1">
                                <label htmlFor="entity" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Entity</label>
                                <Select value={entityId || 'all'} onValueChange={(value) => setEntityId(value === 'all' ? '' : value ?? '')}>
                                    <SelectTrigger className="h-[38px] w-full border border-border/50 bg-accent text-secondary-foreground">
                                        <SelectValue placeholder="All entities">
                                            {entityOptions.find((option) => option.value === entityId)?.label ?? 'All entities'}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All entities</SelectItem>
                                        {entityOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}

                        <div className="space-y-1">
                            <label htmlFor="search" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Search</label>
                            <input
                                id="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search forms"
                                className="h-[38px] w-full rounded-md border border-border/50 bg-accent px-3 text-sm text-secondary-foreground outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-3">
                        <button type="submit" className="flex h-[38px] items-center gap-2 rounded-md bg-secondary-foreground px-5 py-2 text-sm font-semibold text-accent transition-colors hover:bg-secondary-foreground/90">
                            <Filter size={16} /> Filter
                        </button>
                        {selectedYear || selectedStatus || selectedType || selectedEntityId || selectedSearch ? (
                            <Link href={basePath} className="flex h-[38px] items-center px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-secondary-foreground">
                                Clear
                            </Link>
                        ) : null}
                    </div>
                </form>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/30 bg-accent shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead className="border-b border-border/30 bg-secondary/30 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3">Document</th>
                                <th className="px-4 py-3 text-center">FY</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Total / Details</th>
                                <th className="px-4 py-3">Last Updated</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText size={32} className="text-muted-foreground/50" />
                                            <p className="text-sm">No forms found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, index) => {
                                    const showGroupSeparator =
                                        row.groupLabel &&
                                        row.groupLabel !== rows[index - 1]?.groupLabel

                                    return (
                                    <Fragment key={row.id}>
                                    {showGroupSeparator ? (
                                        <tr className="bg-secondary/20">
                                            <td colSpan={6} className="px-4 py-2 text-xs font-black uppercase tracking-wider text-secondary-foreground">
                                                {row.groupLabel}
                                            </td>
                                        </tr>
                                    ) : null}
                                    <tr className="group transition-colors hover:bg-secondary/20">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-secondary-foreground">{row.title}</p>
                                            {row.subtitle ? (
                                                <p className="mt-0.5 text-sm text-muted-foreground">{row.subtitle}</p>
                                            ) : null}
                                            {row.entityLabel ? (
                                                <p className="mt-0.5 text-sm font-medium text-muted-foreground">{row.entityLabel}</p>
                                            ) : null}
                                            {row.typeLabel ? (
                                                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{row.typeLabel}</p>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono font-medium text-secondary-foreground">
                                            {row.fiscalYear}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-block whitespace-nowrap rounded-full border px-3 py-1 text-sm font-bold ${STATUS_COLOR_MAPPER(row.status ?? '')}`}>
                                                {STATUS_LABELS[row.status ?? ''] ?? row.status ?? 'Draft'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-secondary-foreground">
                                            <p className="font-semibold">{row.amountLabel ?? 'N/A'}</p>
                                            {row.detailLabel ? (
                                                <p className="mt-0.5 text-sm text-muted-foreground">{row.detailLabel}</p>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">
                                            {row.updatedAt
                                                ? new Intl.DateTimeFormat('en-PH', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                }).format(new Date(row.updatedAt))
                                                : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={row.href}
                                                className="inline-flex items-center justify-center gap-1 rounded-md border border-border/50 bg-accent px-3 py-1.5 text-sm font-semibold text-secondary-foreground shadow-sm transition-all hover:bg-secondary group-hover:border-accent-foreground group-hover:text-accent-foreground"
                                            >
                                                View <ChevronRight size={14} />
                                            </Link>
                                        </td>
                                    </tr>
                                    </Fragment>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    getPageHref={(targetPage) => buildHref(targetPage)}
                />
            </div>
        </main>
    )
}
