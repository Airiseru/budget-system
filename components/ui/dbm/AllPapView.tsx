'use client'

import BackButton from '@/components/ui/BackButton'
import PaginationControls from '@/components/ui/PaginationControls'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ChevronRight, FileText, Filter, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    PAP_PROJECT_STATUS_LABELS,
    PAP_PROJECT_TYPE_LABELS,
    type PAP_PROJECT_STATUS_TYPES,
} from '@/src/lib/constants'

type PapListItem = {
    id: string
    title: string
    category: string
    project_type: string | null
    entity_name: string | null
    department_name?: string | null
    entity_abbr: string | null
    entity_type: string | null
    project_status: PAP_PROJECT_STATUS_TYPES
    updated_at: string | Date
    full_pap_code?: string | null
}

type PapEntityOption = {
    id: string
    name: string
    abbr: string | null
    entity_type: string
}

const formatProjectType = (type: string | null | undefined) =>
    type && type in PAP_PROJECT_TYPE_LABELS
        ? PAP_PROJECT_TYPE_LABELS[type as keyof typeof PAP_PROJECT_TYPE_LABELS]
        : type?.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? 'N/A'

type AllPapViewProps = {
    paps: PapListItem[]
    entities: PapEntityOption[]
    page: number
    totalPages: number
    selectedEntityId: string
    selectedStatus: PAP_PROJECT_STATUS_TYPES
}

const STATUS_FILTER_OPTIONS: { value: PAP_PROJECT_STATUS_TYPES; label: string }[] = [
    { value: 'approved', label: 'Approved' },
    { value: 'proposed', label: 'Proposed' },
    { value: 'rejected', label: 'Rejected' },
]

export default function AllPapView({
    paps,
    entities,
    page,
    totalPages,
    selectedEntityId,
    selectedStatus,
}: AllPapViewProps) {
    const router = useRouter()
    const [entityId, setEntityId] = useState(selectedEntityId || 'all')
    const [status, setStatus] = useState<PAP_PROJECT_STATUS_TYPES>(selectedStatus)

    const handleFilter = (event: React.SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()

        const params = new URLSearchParams()
        if (entityId && entityId !== 'all') params.set('entityId', entityId)
        if (status !== 'approved') params.set('status', status)
        router.push(`/dbm/paps?${params.toString()}`)
    }

    const getPaginationLink = (targetPage: number) => {
        const params = new URLSearchParams()
        if (selectedEntityId) params.set('entityId', selectedEntityId)
        if (selectedStatus !== 'approved') params.set('status', selectedStatus)
        params.set('page', targetPage.toString())
        return `/dbm/paps?${params.toString()}`
    }

    return (
        <main className="m-6 py-10 max-w-7xl mx-auto space-y-6 px-4">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">DBM PAP Viewer</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Review PAP assignments and update UACS segments per PAP.
                    </p>
                </div>
                <Link href="/dbm/paps/new">
                    <Button className="gap-2 bg-accent-foreground text-white hover:bg-accent-foreground/90">
                        <Plus className="h-4 w-4" />
                        New PAP
                    </Button>
                </Link>
            </div>

            <div className="bg-accent p-4 rounded-xl border border-border/30 shadow-sm">
                <h2 className="text-lg font-semibold mb-2 text-secondary-foreground">Filters</h2>
                <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1 flex-1 min-w-[260px]">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Implementing Entity</label>
                        <Select value={entityId || 'all'} onValueChange={(value) => setEntityId(value ?? 'all')}>
                            <SelectTrigger className="w-full border border-border/50 bg-accent text-secondary-foreground mt-1 mb-0">
                                <SelectValue placeholder="Filter by entity">
                                    {entityId === 'all' ? 'All' : entities.find((entity) => entity.id === entityId)?.name}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {entities.map((entity) => (
                                    <SelectItem key={entity.id} value={entity.id}>
                                        {entity.abbr ? `${entity.abbr} • ${entity.name}` : entity.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1 w-full sm:w-[220px]">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Project Status</label>
                        <Select
                            value={status}
                            onValueChange={(value) => setStatus((value ?? 'approved') as PAP_PROJECT_STATUS_TYPES)}
                        >
                            <SelectTrigger className="w-full border border-border/50 bg-accent text-secondary-foreground mt-1 mb-0">
                                <SelectValue placeholder="Filter by status">
                                    {PAP_PROJECT_STATUS_LABELS[status]}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_FILTER_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <button type="submit" className="flex items-center gap-2 bg-secondary-foreground text-accent px-5 py-2 rounded-md text-sm font-semibold hover:bg-secondary-foreground/90 transition-colors h-[38px]">
                        <Filter size={16} /> Filter
                    </button>

                    {(selectedEntityId || selectedStatus !== 'approved') && (
                        <Link href="/dbm/paps" className="text-sm text-muted-foreground hover:text-secondary-foreground underline underline-offset-2 px-2 h-[38px] flex items-center">
                            Clear
                        </Link>
                    )}
                </form>
            </div>

            <div className="bg-accent border border-border/30 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-secondary/30 border-b border-border/30 text-sm uppercase text-muted-foreground font-bold tracking-wider">
                            <tr>
                                <th className="px-4 py-3">PAP</th>
                                <th className="px-4 py-3">Applicable Entity</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Full Code</th>
                                <th className="px-4 py-3">Last Updated</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {paps.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText size={32} className="text-muted-foreground/50" />
                                            <p className="text-sm">No PAPs found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paps.map((pap) => (
                                    <tr key={pap.id} className="hover:bg-secondary/20 transition-colors group">
                                        <td className="px-4 py-3 max-w-md whitespace-normal break-words">
                                            <p className="font-bold text-secondary-foreground leading-tight">{pap.title}</p>
                                            <p className="text-sm text-muted-foreground mt-1">{pap.category.charAt(0).toUpperCase() + pap.category.slice(1)} Project</p>
                                        </td>
                                        <td className="px-4 py-3 max-w-md whitespace-normal break-words">
                                            <div className="flex items-center gap-4">
                                                <div>
                                                    <p className="font-bold text-secondary-foreground leading-tight">{pap.entity_name || 'All Entities'}</p>
                                                    <p className="text-sm text-muted-foreground break-words">{pap.department_name || 'No specific department'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-secondary-foreground max-w-md whitespace-normal break-words">
                                            {formatProjectType(pap.project_type)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex rounded-full border border-border/60 bg-secondary/20 px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                                                {PAP_PROJECT_STATUS_LABELS[pap.project_status] ?? pap.project_status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground break-all">
                                            {pap.full_pap_code || 'Not set'}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-sm">
                                            {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(pap.updated_at))}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={`/dbm/paps/${pap.id}`}
                                                className="inline-flex items-center justify-center gap-1 bg-accent border border-border/50 text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground px-3 py-1.5 rounded-md text-sm font-semibold transition-all shadow-sm group-hover:border-accent-foreground group-hover:text-accent-foreground"
                                            >
                                                View <ChevronRight size={14} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <PaginationControls
                    page={page}
                    totalPages={totalPages}
                    getPageHref={getPaginationLink}
                />
            </div>
        </main>
    )
}
