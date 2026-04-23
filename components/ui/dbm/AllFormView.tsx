"use client";

import BackButton from '@/components/ui/BackButton'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FORM_TYPES, FORM_NAMES, STATUS_LABELS, STATUS_COLOR_MAPPER } from '@/src/lib/constants';
import { Filter, ChevronRight, FileText, Building2 } from 'lucide-react'

interface DBMFormViewProps {
    forms: any[]
    page: number
    totalPages: number
    hasNextPage: boolean
    selectedYear?: number
    selectedStatus: string
    selectedType: string
}

// Helper to generate the pagination array with ellipses
const generatePageNumbers = (currentPage: number, totalPages: number) => {
    if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
        return [1, 2, 3, '...', totalPages];
    }
    if (currentPage >= totalPages - 2) {
        return [1, '...', totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage, '...', totalPages];
};

export default function AllFormView({ 
    forms, 
    page,
    totalPages,
    hasNextPage, 
    selectedYear, 
    selectedStatus, 
    selectedType 
}: DBMFormViewProps) {
    const router = useRouter();

    // 1. Intercept the form submission to prevent a hard reload
    // and cleanly build the URL parameters
    const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const formData = new FormData(e.currentTarget);
        const year = formData.get('year') as string;
        const status = formData.get('status') as string;
        const type = formData.get('type') as string;

        const params = new URLSearchParams();
        
        if (year) params.set('year', year);
        if (status) params.set('status', status);
        if (type) params.set('type', type);
        router.push(`/dbm/forms?${params.toString()}`);
    }

    // Build pagination URLs without risking "undefined" strings
    const getPaginationLink = (targetPage: number) => {
        const params = new URLSearchParams();
        
        if (selectedYear) params.set('year', selectedYear.toString());
        if (selectedStatus) params.set('status', selectedStatus);
        if (selectedType) params.set('type', selectedType);
        
        params.set('page', targetPage.toString());
        
        return `/dbm/forms?${params.toString()}`;
    }
    
    return (
        <main className="m-6 py-10 max-w-7xl mx-auto space-y-6">
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
                <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1 flex-1 min-w-[150px]">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Fiscal Year</label>
                        <input 
                            type="number" 
                            name="year" 
                            defaultValue={selectedYear || ""}
                            placeholder="e.g. 2026"
                            className="w-full p-2 text-sm border border-border/50 bg-accent text-secondary-foreground rounded-md focus:ring-2 focus:ring-ring outline-none" 
                        />
                    </div>
                    
                    <div className="space-y-1 flex-1 min-w-[200px]">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Status</label>
                        <select name="status" defaultValue={selectedStatus} className="w-full p-2 text-sm border border-border/50 bg-accent text-secondary-foreground rounded-md focus:ring-2 focus:ring-ring outline-none">
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                <option key={key} value={key !== 'none' ? key : ''}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1 flex-1 min-w-[150px]">
                        <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Form Type</label>
                        <select name="type" defaultValue={selectedType} className="w-full p-2 text-sm border border-border/50 bg-accent text-secondary-foreground rounded-md focus:ring-2 focus:ring-ring outline-none">
                            {Object.entries(FORM_TYPES).map(([key, label]) => (
                                <option key={key} value={key !== 'all' ? key : ''}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button type="submit" className="flex items-center gap-2 bg-secondary-foreground text-accent px-5 py-2 rounded-md text-sm font-semibold hover:bg-secondary-foreground/90 transition-colors h-[38px]">
                        <Filter size={16} /> Filter
                    </button>
                    
                    {(selectedYear || selectedStatus || selectedType) && (
                        <Link href="/dbm/forms" className="text-sm text-muted-foreground hover:text-secondary-foreground underline underline-offset-2 px-2 h-[38px] flex items-center">
                            Clear
                        </Link>
                    )}
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
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-4">
                                                <Building2 size={16} className="text-muted-foreground/70 shrink-0" />
                                                <div>
                                                    <p className="font-bold text-secondary-foreground leading-tight">{form.entity_abbr || form.entity_name}</p>
                                                    <p className="text-sm text-muted-foreground line-clamp-1">{form.entity_name}</p>
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
                                            <span className={`px-2.5 py-1 rounded-full text-sm font-bold border ${STATUS_COLOR_MAPPER(form.auth_status ?? "")}`}>
                                                {STATUS_LABELS[form.auth_status ?? ""]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-sm">
                                            {new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(new Date(form.updated_at))}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={form.type === 'bp_staffing' ? `/forms/staff/${form.id}` : form.type === 'bp_retiree' ? `/forms/retirees/${form.id}` : `/dbm/forms/${form.id}`}
                                                className="inline-flex items-center justify-center gap-1 bg-accent border border-border/50 text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground px-3 py-1.5 rounded-md text-sm font-semibold transition-all shadow-sm group-hover:border-accent-foreground group-hover:text-accent-foreground"
                                            >
                                                Evaluate <ChevronRight size={14} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Footer */}
                <div className="bg-muted border-t border-border/30 p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing page <span className="font-bold">{page}</span> of <span className="font-bold">{totalPages}</span>
                    </p>
                    <div className="flex gap-1 items-center">
                        {/* Previous Button (<) */}
                        <Link 
                            href={page > 1 ? getPaginationLink(page - 1) : '#'}
                            className={`px-2.5 py-1.5 rounded text-sm font-bold transition-colors ${page > 1 ? 'bg-accent text-secondary-foreground hover:bg-secondary' : 'bg-accent/50 text-muted-foreground/40 pointer-events-none'}`}
                            aria-disabled={page <= 1}
                        >
                            &lt;
                        </Link>

                        {/* Numbered Pages with Ellipses */}
                        {generatePageNumbers(page, totalPages).map((p, index) => (
                            p === '...' ? (
                                <span key={`ellipsis-${index}`} className="px-2 py-1.5 text-muted-foreground text-sm font-bold">
                                    ...
                                </span>
                            ) : (
                                <Link
                                    key={`page-${p}`}
                                    href={getPaginationLink(p as number)}
                                    className={`px-3 py-1.5 border-b rounded text-sm font-bold transition-colors ${
                                        page === p 
                                            ? 'bg-secondary-foreground text-accent border-secondary-foreground' 
                                            : 'border-border/50 bg-accent text-secondary-foreground hover:bg-secondary'
                                    }`}
                                >
                                    {p}
                                </Link>
                            )
                        ))}

                        {/* Next Button (>) */}
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