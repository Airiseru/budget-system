'use client'

import BackButton from '@/components/ui/BackButton'
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

type PapListItem = {
    id: string
    title: string
    category: string
    project_type: string | null
    entity_name: string | null
    department_name?: string | null
    entity_abbr: string | null
    entity_type: string | null
    updated_at: string | Date
    full_pap_code?: string | null
}

type PapEntityOption = {
    id: string
    name: string
    abbr: string | null
    entity_type: string
}

type AllPapViewProps = {
    paps: PapListItem[]
    entities: PapEntityOption[]
    page: number
    totalPages: number
    selectedEntityId: string
}

const generatePageNumbers = (currentPage: number, totalPages: number) => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
    if (currentPage <= 3) return [1, 2, 3, '...', totalPages]
    if (currentPage >= totalPages - 2) return [1, '...', totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', currentPage, '...', totalPages]
}

export default function AllPapView({
    paps,
    entities,
    page,
    totalPages,
    selectedEntityId,
}: AllPapViewProps) {
    const router = useRouter()
    const [entityId, setEntityId] = useState(selectedEntityId || 'all')

    const handleFilter = (event: React.SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()

        const params = new URLSearchParams()
        if (entityId && entityId !== 'all') params.set('entityId', entityId)
        router.push(`/dbm/paps?${params.toString()}`)
    }

    const getPaginationLink = (targetPage: number) => {
        const params = new URLSearchParams()
        if (selectedEntityId) params.set('entityId', selectedEntityId)
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

                    <button type="submit" className="flex items-center gap-2 bg-secondary-foreground text-accent px-5 py-2 rounded-md text-sm font-semibold hover:bg-secondary-foreground/90 transition-colors h-[38px]">
                        <Filter size={16} /> Filter
                    </button>

                    {selectedEntityId && (
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
                                <th className="px-4 py-3">Full Code</th>
                                <th className="px-4 py-3">Last Updated</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {paps.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
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
                                            {pap.project_type?.toUpperCase() || 'N/A'}
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

                <div className="bg-muted border-t border-border/30 p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing page <span className="font-bold">{page}</span> of <span className="font-bold">{totalPages !== 0 ? totalPages : 1}</span>
                    </p>
                    <div className="flex gap-1 items-center">
                        <Link
                            href={page > 1 ? getPaginationLink(page - 1) : '#'}
                            className={`px-2.5 py-1.5 rounded text-sm font-bold transition-colors ${page > 1 ? 'bg-accent text-secondary-foreground hover:bg-secondary' : 'bg-accent/50 text-muted-foreground/40 pointer-events-none'}`}
                            aria-disabled={page <= 1}
                        >
                            &lt;
                        </Link>

                        {generatePageNumbers(page, totalPages).map((current, index) => (
                            current === '...' ? (
                                <span key={`ellipsis-${index}`} className="px-2 py-1.5 text-muted-foreground text-sm font-bold">...</span>
                            ) : (
                                <Link
                                    key={`page-${current}`}
                                    href={getPaginationLink(current as number)}
                                    className={`px-3 py-1.5 border-b rounded text-sm font-bold transition-colors ${page === current ? 'bg-secondary-foreground text-accent border-secondary-foreground' : 'border-border/50 bg-accent text-secondary-foreground hover:bg-secondary'}`}
                                >
                                    {current}
                                </Link>
                            )
                        ))}

                        <Link
                            href={page < totalPages ? getPaginationLink(page + 1) : '#'}
                            className={`px-2.5 py-1.5 rounded text-sm font-bold transition-colors ${page < totalPages ? 'bg-accent text-secondary-foreground hover:bg-secondary' : 'bg-accent/50 text-muted-foreground/40 pointer-events-none'}`}
                            aria-disabled={page >= totalPages}
                        >
                            &gt;
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    )
}
