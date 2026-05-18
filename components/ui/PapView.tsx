'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import PapDeleteButton from '@/components/ui/PapDeleteButton'
import { FORM_ROUTE_MAP, FORM_TYPES, PAP_PROJECT_STATUS_LABELS, type PAP_PROJECT_STATUS_TYPES, STATUS_LABELS, STATUS_COLOR_MAPPER } from '@/src/lib/constants'
import { ArrowLeft, Pencil } from '@/components/ui/Icons'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ChevronDown, ChevronUp, FileText, Building2, CalendarDays, Hash } from 'lucide-react'

type PapViewData = {
    id: string
    title: string
    category: string
    project_status: string
    description: string | null
    purpose: string | null
    beneficiaries: string | null
    project_type: string | null
    entity_name?: string | null
    entity_abbr?: string | null
    entity_type?: string | null
    parent_agency_name?: string | null
    org_outcome_id?: string | null
    pip_code?: string | null
    cost_structure_code?: string | null
    organizational_outcome_code?: string | null
    program_code?: string | null
    subprogram_code?: string | null
    identifier_code?: string | null
    project_title_code?: string | null
    reserved_codes?: string | null
    full_pap_code?: string | null
    created_at?: string | Date
    updated_at?: string | Date
}

type RelatedForm = {
    id: string
    type: string
    codename: string | null
    fiscal_year: number
    parent_form_id?: string | null
    version?: number
    created_at: string | Date
    updated_at: string | Date
    auth_status: string | null
    entity_name?: string | null
    entity_abbr?: string | null
}

type PapViewProps = {
    pap: PapViewData
    relatedForms: RelatedForm[]
    backHref?: string
    editHref?: string | null
    showDelete?: boolean
    uacsEditor?: React.ReactNode
}

function getFormHref(form: RelatedForm) {
    const route = FORM_ROUTE_MAP[form.type]
    return route ? `${route}/${form.id}` : '#'
}

function getFormTypeLabel(formType: string) {
    return FORM_TYPES[formType] || formType
}

function getProjectStatusClassName(status: string) {
    switch (status) {
        case 'approved':
            return 'bg-secondary-foreground/10 text-secondary-foreground border-secondary-foreground/30'
        case 'rejected':
        case 'cancelled':
            return 'bg-destructive/10 text-destructive border-destructive/30'
        case 'proposed':
        case 'for_release':
        case 'on_going':
            return 'bg-accent-foreground/10 text-accent-foreground border-accent-foreground/30'
        default:
            return 'bg-secondary/50 text-muted-foreground border-border/20'
    }
}

function getProjectStatusLabel(status: string) {
    return PAP_PROJECT_STATUS_LABELS[status as PAP_PROJECT_STATUS_TYPES] ?? status.replace(/_/g, ' ').toUpperCase()
}

export default function PapView({
    pap,
    relatedForms,
    backHref = '/paps',
    editHref = `/paps/${pap.id}/edit`,
    showDelete = true,
    uacsEditor,
}: PapViewProps) {
    const [formsOpen, setFormsOpen] = useState(true)
    const [selectedFormType, setSelectedFormType] = useState('all')

    const availableFormTypes = useMemo(() => {
        return Array.from(new Set(relatedForms.map((form) => form.type))).sort()
    }, [relatedForms])

    const filteredForms = useMemo(() => {
        if (selectedFormType === 'all') return relatedForms
        return relatedForms.filter((form) => form.type === selectedFormType)
    }, [relatedForms, selectedFormType])

    return (
        <div className="max-w-6xl mx-auto mt-8 mb-12 px-4">
            <div className="flex justify-between items-center mb-6 gap-4">
                <Link
                    href={backHref}
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors shrink-0"
                >
                    <ArrowLeft size={16} />
                    Back to List
                </Link>

                {editHref ? (
                    <Link
                        href={editHref}
                        className="flex items-center gap-2 bg-secondary-foreground hover:bg-secondary-foreground/80 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all shadow-sm shrink-0"
                    >
                        <Pencil size={14} />
                        Edit PAP
                    </Link>
                ) : (
                    <div className="w-[104px] shrink-0" />
                )}
            </div>

            <div className="bg-white shadow-sm border rounded-xl overflow-hidden">
                <div className="p-6 border-b bg-gray-50/50 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold text-gray-900">{pap.title}</h1>
                            <p className="text-sm text-gray-500 uppercase tracking-wider font-medium">
                                {pap.category}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${getProjectStatusClassName(pap.project_status)}`}>
                                {getProjectStatusLabel(pap.project_status)}
                            </span>
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {pap.project_type?.toUpperCase() || 'No Project Type'}
                            </span>
                        </div>
                    </div>

                    {pap.entity_name && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <Building2 size={16} className="text-gray-500" />
                            {pap.entity_abbr && (
                                <div>
                                    <span className="font-semibold">{pap.entity_abbr}</span>
                                    <span className="text-gray-400">•</span>
                                </div>
                            )}
                            <div>
                                <span>{pap.entity_name}</span>
                                {pap.entity_type === 'operating_unit' && pap.parent_agency_name && (
                                    <span className="text-gray-600"> under the {pap.parent_agency_name}</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-8">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2 grid gap-6 md:grid-cols-2">
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">PAP ID</label>
                                <p className="font-mono text-xs break-all text-gray-600 bg-gray-50 p-2 rounded border">{pap.id}</p>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">PIP Code</label>
                                <p className="text-gray-700 bg-gray-50 p-2 rounded border min-h-10">{pap.pip_code || 'Not set'}</p>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">Organizational Outcome ID</label>
                                <p className="text-gray-700 bg-gray-50 p-2 rounded border min-h-10">{pap.org_outcome_id || 'Not set'}</p>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">Identifier Code</label>
                                <p className="text-gray-700 bg-gray-50 p-2 rounded border min-h-10">{pap.identifier_code || 'Not set'}</p>
                            </div>
                        </div>

                        <div className="space-y-3 rounded-xl border bg-gray-50 p-4">
                            <div className="flex items-center gap-2">
                                <Hash size={16} className="text-gray-500" />
                                <h2 className="text-sm font-bold text-gray-900">Full PAP Code</h2>
                            </div>
                            <p className="font-mono text-sm break-all text-gray-700">
                                {pap.full_pap_code || 'No complete code yet'}
                            </p>
                            <div className="space-y-2 text-xs text-gray-600">
                                <p><span className="font-semibold">Cost Structure:</span> {pap.cost_structure_code || 'None'}</p>
                                <p><span className="font-semibold">Org Outcome:</span> {pap.organizational_outcome_code || 'None'}</p>
                                <p><span className="font-semibold">Program:</span> {pap.program_code || 'None'}</p>
                                <p><span className="font-semibold">Subprogram:</span> {pap.subprogram_code || 'None'}</p>
                                <p><span className="font-semibold">Identifier:</span> {pap.identifier_code || 'None'}</p>
                                <p><span className="font-semibold">Project Title:</span> {pap.project_title_code || 'None'}</p>
                                <p><span className="font-semibold">Reserved:</span> {pap.reserved_codes || 'None'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">Description</label>
                            <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded border min-h-28 whitespace-pre-wrap">
                                {pap.description || 'No description provided.'}
                            </p>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">Purpose</label>
                            <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded border min-h-28 whitespace-pre-wrap">
                                {pap.purpose || 'No purpose provided.'}
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">Beneficiaries</label>
                        <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded border whitespace-pre-wrap">
                            {pap.beneficiaries || 'No beneficiaries provided.'}
                        </p>
                    </div>

                    {(pap.created_at || pap.updated_at) && (
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border bg-gray-50 p-4">
                                <div className="flex items-center gap-2 text-gray-500 mb-1">
                                    <CalendarDays size={14} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Created</span>
                                </div>
                                <p className="text-sm text-gray-700">
                                    {pap.created_at ? new Date(pap.created_at).toLocaleString() : 'Unavailable'}
                                </p>
                            </div>
                            <div className="rounded-lg border bg-gray-50 p-4">
                                <div className="flex items-center gap-2 text-gray-500 mb-1">
                                    <CalendarDays size={14} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Last Updated</span>
                                </div>
                                <p className="text-sm text-gray-700">
                                    {pap.updated_at ? new Date(pap.updated_at).toLocaleString() : 'Unavailable'}
                                </p>
                            </div>
                        </div>
                    )}

                    {uacsEditor}

                    <div className="rounded-xl border overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-gray-50 p-4">
                            <button
                                type="button"
                                onClick={() => setFormsOpen((current) => !current)}
                                className="flex items-center gap-2 text-left"
                            >
                                {formsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                <h2 className="text-sm font-bold text-gray-900">Associated Budget Forms</h2>
                                <span className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">
                                    {relatedForms.length}
                                </span>
                            </button>
                        </div>

                        {formsOpen && (
                            <div className="p-4 space-y-4">
                                <div className="flex justify-end">
                                    <Select value={selectedFormType} onValueChange={(value) => setSelectedFormType(value ?? 'all')}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Filter by form type">
                                                {selectedFormType === 'all' ? 'All Form Types' : getFormTypeLabel(selectedFormType)}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Form Types</SelectItem>
                                            {availableFormTypes.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {getFormTypeLabel(type)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {filteredForms.length > 0 ? (
                                    <div className="grid gap-3">
                                        {filteredForms.map((form) => (
                                            <Link
                                                key={form.id}
                                                href={getFormHref(form)}
                                                className="group block p-4 border rounded-lg hover:border-accent-foreground transition-all"
                                            >
                                                <div className="flex flex-wrap justify-between gap-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <FileText size={16} className="text-gray-500" />
                                                            <span className="text-sm font-bold group-hover:text-secondary-foreground">
                                                                {getFormTypeLabel(form.type)}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 font-mono">
                                                            {form.codename || form.type}
                                                        </p>
                                                        {form.version && form.version > 1 ? (
                                                            <p className="text-xs font-medium text-secondary-foreground">
                                                                Latest version • v{form.version}
                                                            </p>
                                                        ) : null}
                                                        <p className="text-xs text-gray-500">
                                                            FY {form.fiscal_year} • {new Date(form.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                        {(form.entity_name || form.entity_abbr) && (
                                                            <p className="text-xs text-gray-600">
                                                                {form.entity_abbr || form.entity_name}
                                                                {form.entity_abbr && form.entity_name ? ` • ${form.entity_name}` : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLOR_MAPPER(form.auth_status ?? '')}`}>
                                                            {STATUS_LABELS[form.auth_status ?? ''] || form.auth_status || 'Unknown'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 border-2 border-dashed rounded-lg bg-gray-50">
                                        <p className="text-sm text-gray-400 italic">No forms match the selected type.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {showDelete && (
                        <div className="pt-6 border-t">
                            <div className="flex justify-between items-center gap-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Danger Zone</h3>
                                    <p className="text-xs text-gray-500">Irreversible actions for this PAP record.</p>
                                </div>
                                <PapDeleteButton id={pap.id} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
