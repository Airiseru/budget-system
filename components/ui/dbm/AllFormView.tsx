"use client";

import BackButton from '@/components/ui/BackButton'
import PaginationControls from '@/components/ui/PaginationControls'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FORM_TYPES, FORM_NAMES, STATUS_LABELS, STATUS_COLOR_MAPPER } from '@/src/lib/constants'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Filter, ChevronRight, FileText, Building2 } from 'lucide-react'

type DBMFormListItem = {
    id: string
    entity_abbr: string | null
    entity_name: string | null
    department_name?: string | null
    type: string | null
    codename: string
    fiscal_year: number
    version: number
    auth_status: string | null
    updated_at: Date | string
}

interface DBMFormViewProps {
    forms: DBMFormListItem[]
    page: number
    totalPages: number
    selectedYear?: number
    selectedStatus: string
    selectedType: string
    includeVersionHistory: boolean
}

export default function AllFormView({ 
    forms, 
    page,
    totalPages,
    selectedYear, 
    selectedStatus, 
    selectedType,
    includeVersionHistory,
}: DBMFormViewProps) {
    const router = useRouter();
    const [year, setYear] = useState(selectedYear?.toString() ?? "")
    const [status, setStatus] = useState(selectedStatus || "")
    const [type, setType] = useState(selectedType || "")
    const [showVersionHistory, setShowVersionHistory] = useState(includeVersionHistory)

    const handleFilter = (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();

        const params = new URLSearchParams();
        
        if (year) params.set('year', year);
        if (status) params.set('status', status);
        if (type) params.set('type', type);
        if (showVersionHistory) params.set('includeHistory', 'true');
        router.push(`/dbm/forms?${params.toString()}`);
    }

    // Build pagination URLs without risking "undefined" strings
    const getPaginationLink = (targetPage: number) => {
        const params = new URLSearchParams();
        
        if (selectedYear) params.set('year', selectedYear.toString());
        if (selectedStatus) params.set('status', selectedStatus);
        if (selectedType) params.set('type', selectedType);
        if (includeVersionHistory) params.set('includeHistory', 'true');
        
        params.set('page', targetPage.toString());
        
        return `/dbm/forms?${params.toString()}`;
    }
    
    return (
        <main className="m-6 py-10 max-w-7xl mx-auto space-y-6 px-4">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">DBM Form Viewer</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Evaluate and manage budget requests across all government entities.
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            {/* Filter Bar */}
            <div className="bg-accent p-4 rounded-xl border border-border/30 shadow-sm">
                <h2 className="text-lg font-semibold mb-2 text-secondary-foreground">Filters</h2>
                <form onSubmit={handleFilter} className="flex flex-wrap flex-col gap-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="space-y-1 flex-1 min-w-[150px]">
                            <label htmlFor='year' className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Fiscal Year</label>
                            <input 
                                type="number" 
                                name="year" 
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                placeholder="e.g. 2026"
                                className="w-full p-2 text-sm border border-border/50 bg-accent text-secondary-foreground rounded-md focus:ring-2 focus:ring-ring outline-none" 
                            />
                        </div>
                        
                        <div className="space-y-1 flex-1 min-w-[200px]">
                            <label htmlFor='type' className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Status</label>
                            <Select value={status || "none"} onValueChange={(value: string | null) => setStatus(value ? (value === "none" ? "" : value) : "")}>
                                <SelectTrigger className="w-full border border-border/50 bg-accent text-secondary-foreground mb-0 height-[38px]">
                                    <SelectValue placeholder="Select a status">
                                        {status ? STATUS_LABELS[status] : "All"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key !== 'none' ? key : 'none'}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1 flex-1 min-w-[150px]">
                            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Form Type</label>
                            <Select value={type || "all"} onValueChange={(value) => setType(value ? (value === "all" ? "" : value) : "")}>
                                <SelectTrigger className="w-full border border-border/50 bg-accent text-secondary-foreground mb-0 height-[38px]">
                                    <SelectValue placeholder="Select a form type">
                                        {type ? FORM_TYPES[type] : "All"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(FORM_TYPES).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 justify-between">
                        <label className="flex h-[38px] items-center gap-2 rounded-md border border-border/50 bg-accent px-3 text-sm font-semibold text-secondary-foreground">
                            <input
                                type="checkbox"
                                checked={showVersionHistory}
                                onChange={(event) => setShowVersionHistory(event.target.checked)}
                                className="h-4 w-4"
                            />
                            Show all versions
                        </label>

                        <div className="flex flex-wrap gap-4">
                            <button type="submit" className="flex items-center gap-2 bg-secondary-foreground text-accent px-5 py-2 rounded-md text-md font-semibold hover:bg-secondary-foreground/90 transition-colors h-[38px]">
                                <Filter size={16} /> Filter
                            </button>
                            
                            {(year || status || type || showVersionHistory) && (
                                <Link href="/dbm/forms" className="text-sm text-muted-foreground hover:text-secondary-foreground underline underline-offset-2 px-2 h-[38px] flex items-center">
                                    Clear
                                </Link>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            {/* Data Table */}
            <div className="bg-accent border border-border/30 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-secondary/30 border-b border-border/30 text-sm uppercase text-muted-foreground font-bold tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Entity</th>
                                <th className="px-4 py-3">Document</th>
                                <th className="px-4 py-3 text-center">FY</th>
                                <th className="px-4 py-3 text-center">Version</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Last Updated</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {forms.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText size={32} className="text-muted-foreground/50" />
                                            <p className="text-sm">No forms found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                forms.map((form) => (
                                    <tr key={form.id} className="hover:bg-secondary/20 transition-colors group">
                                        <td className="px-4 py-3 max-w-md whitespace-normal break-words align-center">
                                            <div className="flex items-center gap-4">
                                                <Building2 size={16} className="text-muted-foreground/70 shrink-0" />
                                                <div>
                                                    <p className="font-bold text-secondary-foreground leading-tight">{form.entity_name}</p>
                                                    <p className="text-sm text-muted-foreground">{form.department_name || 'No department'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-secondary-foreground">{FORM_NAMES[form.type ?? ''] || form.type}</p>
                                            <p className="text-sm text-muted-foreground font-mono mt-0.5">{form.codename}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center font-mono font-medium text-secondary-foreground">
                                            {form.fiscal_year}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-sm font-bold font-mono">
                                                v{form.version}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold border inline-block whitespace-nowrap ${STATUS_COLOR_MAPPER(form.auth_status ?? "")}`}>
                                                {STATUS_LABELS[form.auth_status ?? ""]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-sm">
                                            {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(form.updated_at))}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={`/dbm/forms/${form.id}`}
                                                className="inline-flex items-center justify-center gap-1 bg-accent border border-border/50 text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground px-3 py-1.5 rounded-md text-sm font-semibold transition-all shadow-sm group-hover:border-accent-foreground group-hover:text-accent-foreground"
                                            >
                                                {form.auth_status === 'pending_dbm' ? 'Evaluate' : 'View'} <ChevronRight size={14} />
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
