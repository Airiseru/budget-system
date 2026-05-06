'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronRight, Filter, Package2, Plus, Trash2 } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { ItemCatalogListItem } from '@/src/db/postgres/repositories/itemRepository'
import type { ItemCatalogScope } from '@/src/types/line_items'
import { EXPENSE_CLASS_OPTIONS } from '@/src/lib/constants'

type EntityOption = {
    id: string
    name: string
    abbr: string | null
    entity_type: string
}

type Props = {
    items: ItemCatalogListItem[]
    entities: EntityOption[]
    page: number
    totalPages: number
    selectedScope: string
    selectedEntityId: string
    selectedExpenseClass: string
}

const SCOPE_OPTIONS: { value: 'all' | ItemCatalogScope; label: string }[] = [
    { value: 'all', label: 'All Scopes' },
    { value: 'global', label: 'Global' },
    { value: 'entity', label: 'Entity' },
    { value: 'pap', label: 'PAP' },
]

const SCOPE_LABELS: Record<ItemCatalogScope, string> = {
    global: 'Global',
    entity: 'Entity',
    pap: 'PAP',
}

const generatePageNumbers = (currentPage: number, totalPages: number) => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
    if (currentPage <= 3) return [1, 2, 3, '...', totalPages]
    if (currentPage >= totalPages - 2) return [1, '...', totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', currentPage, '...', totalPages]
}

export function ItemCatalogTable({
    items,
    entities,
    page,
    totalPages,
    selectedScope,
    selectedEntityId,
    selectedExpenseClass,
}: Props) {
    const router = useRouter()
    const [scopeFilter, setScopeFilter] = useState<'all' | ItemCatalogScope>((selectedScope as 'all' | ItemCatalogScope) || 'all')
    const [entityFilter, setEntityFilter] = useState<string>(selectedEntityId || 'all')
    const [expenseClassFilter, setExpenseClassFilter] = useState<string>(selectedExpenseClass || 'all')

    const handleFilter = (event: React.SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()

        const params = new URLSearchParams()
        if (scopeFilter !== 'all') params.set('scope', scopeFilter)
        if (entityFilter !== 'all') params.set('entityId', entityFilter)
        if (expenseClassFilter !== 'all') params.set('expenseClass', expenseClassFilter)

        router.push(`/dbm/items?${params.toString()}`)
    }

    const getPaginationLink = (targetPage: number) => {
        const params = new URLSearchParams()
        if (selectedScope) params.set('scope', selectedScope)
        if (selectedEntityId) params.set('entityId', selectedEntityId)
        if (selectedExpenseClass) params.set('expenseClass', selectedExpenseClass)
        params.set('page', targetPage.toString())
        return `/dbm/items?${params.toString()}`
    }

    return (
        <main className="m-6 py-10 max-w-7xl mx-auto space-y-6 px-4">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Manage Item Catalog</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Create and update general line items for global, entity, or PAP-specific use.
                    </p>
                </div>
                <Link href="/dbm/items/new">
                    <Button className="gap-2 bg-accent-foreground text-white hover:bg-accent-foreground/90">
                        <Plus className="h-4 w-4" />
                        New Item
                    </Button>
                </Link>
            </div>

            <div className="bg-accent p-4 rounded-xl border border-border/30 shadow-sm">
                <h2 className="text-lg font-semibold mb-2 text-secondary-foreground">Filters</h2>
                <form onSubmit={handleFilter} className="grid gap-4 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_auto_auto] xl:items-end">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Scope</label>
                        <Select value={scopeFilter} onValueChange={(value) => setScopeFilter((value as 'all' | ItemCatalogScope | undefined) ?? 'all')}>
                            <SelectTrigger className="w-full border border-border/50 bg-accent text-secondary-foreground">
                                <SelectValue placeholder="Filter by scope">
                                    {scopeFilter === 'all' ? 'All Scopes' : SCOPE_LABELS[scopeFilter]}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {SCOPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Entity</label>
                        <Select value={entityFilter} onValueChange={(value) => setEntityFilter(value ?? 'all')}>
                            <SelectTrigger className="w-full border border-border/50 bg-accent text-secondary-foreground">
                                <SelectValue placeholder="Filter by entity">
                                    {entityFilter === 'all' ? 'All Entities' : entities.find((entity) => entity.id === entityFilter)?.name}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Entities</SelectItem>
                                {entities.map((entity) => (
                                    <SelectItem key={entity.id} value={entity.id}>
                                        {entity.abbr ? `${entity.abbr} • ${entity.name}` : entity.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Expense Class</label>
                        <Select value={expenseClassFilter} onValueChange={(value) => setExpenseClassFilter(value ?? 'all')}>
                            <SelectTrigger className="w-full border border-border/50 bg-accent text-secondary-foreground">
                                <SelectValue placeholder="Filter by expense class">
                                    {expenseClassFilter === 'all' ? 'All Expense Classes' : expenseClassFilter}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Expense Classes</SelectItem>
                                    {EXPENSE_CLASS_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <button type="submit" className="flex items-center justify-center gap-2 bg-secondary-foreground text-accent px-5 py-2 rounded-md text-sm font-semibold hover:bg-secondary-foreground/90 transition-colors h-[38px]">
                        <Filter size={16} /> Filter
                    </button>

                    {(scopeFilter !== 'all' || entityFilter !== 'all' || expenseClassFilter !== 'all') && (
                        <Link href="/dbm/items" className="text-sm text-muted-foreground hover:text-secondary-foreground underline underline-offset-2 px-2 h-[38px] flex items-center">
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
                                <th className="px-4 py-3">Item</th>
                                <th className="px-4 py-3">Object Code</th>
                                <th className="px-4 py-3">Expense Class</th>
                                <th className="px-4 py-3">Scope</th>
                                <th className="px-4 py-3">Entity / PAP</th>
                                <th className="px-4 py-3">Last Updated</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Package2 size={32} className="text-muted-foreground/50" />
                                            <p className="text-sm">No item catalog records found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.id} className="hover:bg-secondary/20 transition-colors group">
                                        <td className="px-4 py-3 max-w-md whitespace-normal break-words">
                                            <p className="font-bold text-secondary-foreground leading-tight">{item.name}</p>
                                            <p className="text-sm text-muted-foreground mt-1">{item.description || 'No description'}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-mono text-xs text-secondary-foreground break-all">{item.uacs_obj_code}</p>
                                            <p className="text-sm text-muted-foreground mt-1 whitespace-normal break-words">
                                                {item.object_code_description || 'No description'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-secondary-foreground">
                                            <p className="font-semibold">{item.expense_class}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Code {item.expense_class_code}</p>
                                        </td>
                                        <td className="px-4 py-3 text-secondary-foreground">{SCOPE_LABELS[item.scope]}</td>
                                        <td className="px-4 py-3 max-w-md whitespace-normal break-words">
                                            <p className="font-semibold text-secondary-foreground">{item.entity_name || 'All entities'}</p>
                                            <p className="text-sm text-muted-foreground mt-1">{item.pap_title || 'Not PAP-specific'}</p>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-sm">
                                            {new Intl.DateTimeFormat('en-PH', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: 'numeric',
                                                minute: 'numeric',
                                            }).format(new Date(item.updated_at))}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex flex-col items-center justify-end gap-2">
                                                <Link
                                                    href={`/dbm/items/${item.id}/edit`}
                                                    className="inline-flex items-center justify-center gap-1 bg-accent border border-border/50 text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground px-3 py-1.5 rounded-md text-sm font-semibold transition-all shadow-sm group-hover:border-accent-foreground group-hover:text-accent-foreground"
                                                >
                                                    Edit <ChevronRight size={14} />
                                                </Link>
                                                <Link
                                                    href={`/dbm/items/${item.id}/delete`}
                                                    className="inline-flex items-center justify-center gap-1 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors"
                                                >
                                                    Delete <Trash2 size={14} />
                                                </Link>
                                            </div>
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
                                <span key={`ellipsis-${index}`} className="px-2 py-1.5 text-muted-foreground text-sm font-bold">
                                    ...
                                </span>
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
