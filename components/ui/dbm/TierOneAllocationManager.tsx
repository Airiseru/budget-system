'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import BudgetPrepClosedBanner from '@/components/ui/BudgetPrepClosedBanner'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { createTierOneAllocationAction, updateTierOneAllocationAction } from '@/src/actions/budgetAllocations'
import type { BUDGET_PREP_WORKFLOW_STAGES_TYPE } from '@/src/lib/constants'
import type { BudgetCycle } from '@/src/types/budget_settings'
import type { ItemCatalogScope } from '@/src/types/line_items'
import type { AllocationWorkflowLogEntry, BudgetAllocationListItem } from '@/src/db/postgres/repositories/budgetAllocationRepository'
import { Pencil } from 'lucide-react'
import CollapsibleRemarksSection from '@/components/ui/remarks/CollapsibleRemarksSection'

type EntityOption = {
    id: string
    name: string
    entity_type: string
    uacs_code?: string | null
    department_id?: string | null
    agency_id?: string | null
    parent_ou_id?: string | null
}

type PapOption = {
    id: string
    title: string
    entity_id: string | null
    entity_name: string | null
}

type ItemOption = {
    id: string
    name: string
    scope: ItemCatalogScope
    entity_id: string | null
    pap_code: string | null
    expense_class: string
}

type FundingSourceOption = {
    code: string
    description: string
}

const REMARK_STAGE_OPTIONS: { value: BUDGET_PREP_WORKFLOW_STAGES_TYPE; label: string }[] = [
    { value: 'entity_proposal', label: 'Entity' },
    { value: 'dbm_review', label: 'DBM Review' },
    { value: 'dbm_appeal', label: 'DBM Appeal' },
]

type Props = {
    activeCycle: BudgetCycle | null
    viewingYear: number | null
    availableYears: number[]
    isViewingOnly: boolean
    entities: EntityOption[]
    paps: PapOption[]
    items: ItemOption[]
    fundingSources: FundingSourceOption[]
    allocations: BudgetAllocationListItem[]
    mode?: 'create' | 'edit'
    initialValues?: Partial<BudgetAllocationListItem>
    remarks?: AllocationWorkflowLogEntry[]
}

export function TierOneAllocationManager({
    activeCycle,
    viewingYear,
    availableYears,
    isViewingOnly,
    entities,
    paps,
    items,
    fundingSources,
    allocations,
    mode = 'create',
    initialValues,
    remarks = [],
}: Props) {
    const router = useRouter()
    const actionFn = mode === 'edit' ? updateTierOneAllocationAction : createTierOneAllocationAction
    const [state, action, pending] = useActionState(actionFn, undefined)
    const [entityId, setEntityId] = useState(state?.values?.entity_id ?? initialValues?.entity_id ?? '')
    const [papCode, setPapCode] = useState(state?.values?.pap_code ?? initialValues?.pap_code ?? '')
    const [itemCatalogId, setItemCatalogId] = useState(state?.values?.item_catalog_id ?? initialValues?.item_catalog_id ?? '')
    const [fundCode, setFundCode] = useState(state?.values?.fund_code ?? initialValues?.fund_code ?? '')
    const [workflowStage, setWorkflowStage] = useState<BUDGET_PREP_WORKFLOW_STAGES_TYPE>(
        ((state?.values?.workflow_stage ?? 'dbm_review') as BUDGET_PREP_WORKFLOW_STAGES_TYPE)
    )

    const departments = useMemo(
        () => entities
            .filter((entity) => entity.entity_type === 'department')
            .sort((a, b) => (a.uacs_code ?? '').localeCompare(b.uacs_code ?? '')),
        [entities]
    )
    const agencies = useMemo(
        () => entities
            .filter((entity) => entity.entity_type === 'agency')
            .sort((a, b) => (a.uacs_code ?? '').localeCompare(b.uacs_code ?? '')),
        [entities]
    )
    const operatingUnits = useMemo(
        () => entities
            .filter((entity) => entity.entity_type === 'operating_unit')
            .sort((a, b) => (a.uacs_code ?? '').localeCompare(b.uacs_code ?? '')),
        [entities]
    )
    const independentAgencies = useMemo(
        () => agencies.filter((agency) => agency.department_id == null),
        [agencies]
    )

    const availablePaps = useMemo(() => {
        return paps.filter((pap) => pap.entity_id == null || pap.entity_id === entityId)
    }, [entityId, paps])

    const availableItems = useMemo(() => {
        return items.filter((item) => {
            if (item.scope === 'global') return true
            if (item.scope === 'entity') return item.entity_id === entityId
            return !!papCode && item.pap_code === papCode
        })
    }, [entityId, items, papCode])

    const getEntityName = (id: string) => {
        const department = departments.find((entity) => entity.id === id)
        if (department) return `${department.name} (Central Office)`

        const agency = agencies.find((entity) => entity.id === id)
        if (agency) return agency.name

        const operatingUnit = operatingUnits.find((entity) => entity.id === id)
        if (operatingUnit) return operatingUnit.name

        return ''
    }

    const [selectedYear, setSelectedYear] = useState(viewingYear ? String(viewingYear) : '')

    return (
        <main className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
                <div className="flex items-center justify-between">
                    <BackButton url="/dbm" />
                    <div className="text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Tier One Allocations</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            {activeCycle ? 'Create Tier One budget allocations for the current active fiscal year.' : 'View Tier One budget allocations for past fiscal years.'}
                        </p>
                    </div>
                    <div className="w-[73px]" />
                </div>

                {!activeCycle && (
                    <BudgetPrepClosedBanner message="There is no active budget cycle. Select a fiscal year below to view Tier One allocations." />
                )}

                {activeCycle ? (
                    <div className="rounded-lg border border-border bg-accent/30 px-4 py-3 text-sm text-secondary-foreground">
                        Creating allocations for Fiscal Year <span className="font-bold">{activeCycle.fiscal_year}</span>.
                    </div>
                ) : availableYears.length > 0 ? (
                    <div className="rounded-lg border border-border bg-background px-4 py-4">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault()
                                if (!selectedYear) return
                                router.push(`/dbm/tier-one?year=${selectedYear}`)
                            }}
                            className="flex flex-wrap items-end gap-4"
                        >
                            <div className="space-y-2 min-w-[220px]">
                                <p className="font-medium">Fiscal Year</p>
                                <Select value={selectedYear} onValueChange={(value) => setSelectedYear(value ?? '')}>
                                    <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background mb-0">
                                        <SelectValue placeholder="Select fiscal year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableYears.map((year) => (
                                            <SelectItem key={year} value={String(year)}>
                                                FY {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="submit" className="bg-accent-foreground text-white hover:bg-accent-foreground/90">
                                View Allocations
                            </Button>
                        </form>
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                        No budget cycles are available yet.
                    </div>
                )}

                <div className={`grid gap-8 ${isViewingOnly && mode === 'create' ? '' : 'xl:grid-cols-[420px_1fr]'}`}>
                    {!isViewingOnly && (
                    <form action={action} className="space-y-5 rounded-xl border border-border bg-background p-6">
                        {mode === 'edit' && (
                            <input type="hidden" name="id" value={initialValues?.id ?? ''} />
                        )}
                        <div>
                            <h2 className="text-lg font-semibold text-secondary-foreground">
                                {mode === 'edit' ? 'Edit Allocation' : 'New Allocation'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Select the entity, PAP, item catalog, and funding source for this Tier One allocation.
                            </p>
                        </div>

                        {state?.formErrors?.[0] && (
                            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {state.formErrors[0]}
                            </div>
                        )}

                        <input type="hidden" name="entity_id" value={entityId} />
                        <input type="hidden" name="pap_code" value={papCode} />
                        <input type="hidden" name="item_catalog_id" value={itemCatalogId} />
                        <input type="hidden" name="fund_code" value={fundCode} />
                        <input type="hidden" name="workflow_stage" value={workflowStage} />

                        <div className="space-y-2">
                            <label className="font-medium">Entity</label>
                            <Select value={entityId} onValueChange={(value) => {
                                setEntityId(value ?? '')
                                setPapCode('')
                                setItemCatalogId('')
                            }}>
                                <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background">
                                    <SelectValue placeholder="Select entity">
                                        {entityId ? getEntityName(entityId) : 'Select entity'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((department) => {
                                        const childAgencies = agencies.filter((agency) => agency.department_id === department.id)
                                        return (
                                            <SelectGroup key={department.id}>
                                                <SelectLabel className="bg-muted/50">{department.name}</SelectLabel>
                                                <SelectItem value={department.id}>{department.name} (Central Office)</SelectItem>
                                                {childAgencies.map((agency) => (
                                                    <div key={agency.id}>
                                                        <SelectItem value={agency.id}>{agency.name}</SelectItem>
                                                        {operatingUnits
                                                            .filter((operatingUnit) => operatingUnit.agency_id === agency.id)
                                                            .map((operatingUnit) => (
                                                                <SelectItem key={operatingUnit.id} value={operatingUnit.id}>
                                                                    {`↳ ${operatingUnit.name}`}
                                                                </SelectItem>
                                                            ))}
                                                    </div>
                                                ))}
                                            </SelectGroup>
                                        )
                                    })}
                                    {independentAgencies.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel className="bg-muted/50">Independent Agencies & SUCs</SelectLabel>
                                            {independentAgencies.map((agency) => (
                                                <div key={agency.id}>
                                                    <SelectItem value={agency.id}>{agency.name}</SelectItem>
                                                    {operatingUnits
                                                        .filter((operatingUnit) => operatingUnit.agency_id === agency.id)
                                                        .map((operatingUnit) => (
                                                            <SelectItem key={operatingUnit.id} value={operatingUnit.id}>
                                                                {`↳ ${operatingUnit.name}`}
                                                            </SelectItem>
                                                        ))}
                                                </div>
                                            ))}
                                        </SelectGroup>
                                    )}
                                </SelectContent>
                            </Select>
                            {state?.fieldErrors?.entity_id?.[0] && <p className="text-sm text-red-500 italic">{state.fieldErrors.entity_id[0]}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="font-medium">PAP</label>
                            <Select value={papCode} onValueChange={(value) => {
                                setPapCode(value ?? '')
                                setItemCatalogId('')
                            }}>
                                <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background">
                                    <SelectValue placeholder="Select PAP">
                                        {papCode ? availablePaps.find((pap) => pap.id === papCode)?.title : 'Select PAP'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {availablePaps.map((pap) => (
                                        <SelectItem key={pap.id} value={pap.id}>
                                            {pap.entity_id == null ? `${pap.title} (All entities)` : pap.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {state?.fieldErrors?.pap_code?.[0] && <p className="text-sm text-red-500 italic">{state.fieldErrors.pap_code[0]}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="font-medium">Item Catalog</label>
                            <Select value={itemCatalogId} onValueChange={(value) => setItemCatalogId(value ?? '')}>
                                <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background">
                                    <SelectValue placeholder="Select item catalog">
                                        {itemCatalogId ? availableItems.find((item) => item.id === itemCatalogId)?.name : 'Select item catalog'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {availableItems.map((item) => (
                                        <SelectItem key={item.id} value={item.id}>
                                            {item.name} ({item.expense_class})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {state?.fieldErrors?.item_catalog_id?.[0] && <p className="text-sm text-red-500 italic">{state.fieldErrors.item_catalog_id[0]}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="font-medium">Fund Source</label>
                            <Select value={fundCode} onValueChange={(value) => setFundCode(value ?? '')}>
                                <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background">
                                    <SelectValue placeholder="Select fund source">
                                        {fundCode ? fundingSources.find((source) => source.code === fundCode)?.description : 'Select fund source'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {fundingSources.map((source) => (
                                        <SelectItem key={source.code} value={source.code}>
                                            {source.code} • {source.description}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {state?.fieldErrors?.fund_code?.[0] && <p className="text-sm text-red-500 italic">{state.fieldErrors.fund_code[0]}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="font-medium" htmlFor="specific_description">Specific Description</label>
                            <textarea
                                id="specific_description"
                                name="specific_description"
                                defaultValue={state?.values?.specific_description ?? initialValues?.specific_description ?? ''}
                                className="min-h-24 w-full rounded border border-border bg-background px-3 py-2"
                                placeholder="Optional context for this allocation."
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="font-medium" htmlFor="quantity">Quantity</label>
                                <input id="quantity" name="quantity" type="number" min="1" defaultValue={state?.values?.quantity ?? String(initialValues?.quantity ?? 1)} className="w-full rounded border border-border bg-background px-3 py-2" />
                                {state?.fieldErrors?.quantity?.[0] && <p className="text-sm text-red-500 italic">{state.fieldErrors.quantity[0]}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="font-medium" htmlFor="currency">Currency</label>
                                <input id="currency" name="currency" defaultValue={state?.values?.currency ?? initialValues?.currency ?? 'PHP'} className="w-full rounded border border-border bg-background px-3 py-2" />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="font-medium" htmlFor="proposed_amt">Proposed Amount</label>
                                <input id="proposed_amt" name="proposed_amt" type="number" min="0" step="0.01" defaultValue={state?.values?.proposed_amt ?? String(initialValues?.proposed_amt ?? 0)} className="w-full rounded border border-border bg-background px-3 py-2" />
                            </div>
                            <div className="space-y-2">
                                <label className="font-medium" htmlFor="dbm_rec_amt">DBM Amount</label>
                                <input id="dbm_rec_amt" name="dbm_rec_amt" type="number" min="0" step="0.01" defaultValue={state?.values?.dbm_rec_amt ?? String(initialValues?.dbm_rec_amt ?? 0)} className="w-full rounded border border-border bg-background px-3 py-2" />
                            </div>
                            {/* <div className="space-y-2">
                                <label className="font-medium" htmlFor="nep_amt">NEP Amount</label>
                                <input id="nep_amt" name="nep_amt" type="number" min="0" step="0.01" defaultValue={state?.values?.nep_amt ?? String(initialValues?.nep_amt ?? 0)} className="w-full rounded border border-border bg-background px-3 py-2" />
                            </div>
                            <div className="space-y-2">
                                <label className="font-medium" htmlFor="gaa_amt">GAA Amount</label>
                                <input id="gaa_amt" name="gaa_amt" type="number" min="0" step="0.01" defaultValue={state?.values?.gaa_amt ?? String(initialValues?.gaa_amt ?? 0)} className="w-full rounded border border-border bg-background px-3 py-2" />
                            </div> */}
                        </div>

                        <div className="space-y-2">
                            <label className="font-medium">Remarks For</label>
                            <Select value={workflowStage} onValueChange={(value) => setWorkflowStage((value ?? 'dbm_review') as BUDGET_PREP_WORKFLOW_STAGES_TYPE)}>
                                <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background">
                                    <SelectValue placeholder="Select remarks stage">
                                        {workflowStage ? REMARK_STAGE_OPTIONS.find((option) => option.value === workflowStage)?.label : 'Select remarks stage'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {REMARK_STAGE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {state?.fieldErrors?.workflow_stage?.[0] && <p className="text-sm text-red-500 italic">{state.fieldErrors.workflow_stage[0]}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="font-medium" htmlFor="remarks">Remarks</label>
                            <textarea
                                id="remarks"
                                name="remarks"
                                defaultValue={state?.values?.remarks ?? ''}
                                className="min-h-24 w-full rounded border border-border bg-background px-3 py-2"
                                placeholder={mode === 'edit' ? 'Required remarks for this edit.' : 'Optional context for this allocation.'}
                            />
                            {state?.fieldErrors?.remarks?.[0] && <p className="text-sm text-red-500 italic">{state.fieldErrors.remarks[0]}</p>}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="font-medium" htmlFor="valid_from">Valid From</label>
                                <input id="valid_from" name="valid_from" type="date" defaultValue={state?.values?.valid_from ?? (initialValues?.valid_from ? new Date(initialValues.valid_from).toISOString().split('T')[0] : '')} className="w-full rounded border border-border bg-background px-3 py-2" />
                            </div>
                            <div className="space-y-2">
                                <label className="font-medium" htmlFor="valid_until">Valid Until</label>
                                <input id="valid_until" name="valid_until" type="date" defaultValue={state?.values?.valid_until ?? (initialValues?.valid_until ? new Date(initialValues.valid_until).toISOString().split('T')[0] : '')} className="w-full rounded border border-border bg-background px-3 py-2" />
                            </div>
                        </div>

                        <div className={`flex gap-3 ${mode === 'edit' ? '' : 'flex-col'}`}>
                            <Button
                                type="submit"
                                disabled={!activeCycle || pending}
                                className={`${mode === 'edit' ? 'w-1/2' : 'w-full'} bg-accent-foreground py-5 text-md text-white hover:bg-accent-foreground/90`}
                                >
                                {pending ? (mode === 'edit' ? 'Saving...' : 'Creating...') : (mode === 'edit' ? 'Save Allocation' : 'Create Tier One Allocation')}
                            </Button>
                            {mode === 'edit' && (
                                <Link href="/dbm/tier-one" className="w-1/2">
                                    <Button type="button" variant="outline" className="w-full py-5 text-md">
                                        Cancel
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </form>
                    )}

                    <div className="rounded-xl border border-border bg-background max-h-full overflow-auto-y">
                        <div className="border-b border-border px-6 py-4">
                            <h2 className="text-lg font-semibold text-secondary-foreground">
                                {viewingYear ? `FY ${viewingYear} Allocations` : 'Tier One Allocations'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {viewingYear
                                    ? `Tier One allocations for fiscal year ${viewingYear}.`
                                    : 'Tier One allocations.'}
                            </p>
                        </div>

                        {mode === 'edit' && initialValues?.id && (
                            <div className="border-b border-border px-6 py-5 space-y-4">
                                <CollapsibleRemarksSection
                                    title="Previous Remarks"
                                    description="Remarks submitted from the edit form are stored under the workflow stage selected above."
                                    items={remarks}
                                    maxHeightClassName="max-h-96 overflow-y-auto"
                                    renderItem={(remark, index) => (
                                        <div
                                            key={remark.id}
                                            className={`${index === remarks.length - 1 ? '' : 'border-b'} bg-accent/20 p-4`}
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="text-sm font-semibold text-secondary-foreground">
                                                    {remark.performed_by_name || remark.performed_by}
                                                </div>
                                                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                                    {REMARK_STAGE_OPTIONS.find((option) => option.value === remark.workflow_stage)?.label}
                                                </div>
                                            </div>
                                            <p className="mt-2 whitespace-pre-wrap text-sm text-secondary-foreground">{remark.remarks}</p>
                                            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                                <span>{new Date(remark.created_at).toLocaleString()}</span>
                                                <span>Before: {remark.amt_before == null ? '—' : Number(remark.amt_before).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <span>After: {remark.amt_after == null ? '—' : Number(remark.amt_after).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    )}
                                />
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-secondary/30 border-b border-border/30 text-sm uppercase text-muted-foreground font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Entity</th>
                                        <th className="px-4 py-3">PAP</th>
                                        <th className="px-4 py-3">Item</th>
                                        <th className="px-4 py-3">Fund</th>
                                        <th className="px-4 py-3 text-right">DBM Rec</th>
                                        {!isViewingOnly && <th className="px-4 py-3 text-right">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                    {allocations.length === 0 ? (
                                        <tr>
                                            <td colSpan={isViewingOnly ? 5 : 6} className="px-4 py-10 text-center text-muted-foreground">
                                                {viewingYear
                                                    ? `No Tier One allocations found for fiscal year ${viewingYear}.`
                                                    : 'No Tier One allocations found.'}
                                            </td>
                                        </tr>
                                    ) : allocations.map((allocation) => (
                                        <tr key={allocation.id}>
                                            <td className="px-4 py-3">{allocation.entity_name}</td>
                                            <td className="px-4 py-3">{allocation.pap_title || 'No PAP'}</td>
                                            <td className="px-4 py-3">{allocation.item_name}</td>
                                            <td className="px-4 py-3">{allocation.fund_description || allocation.fund_code || 'No fund source'}</td>
                                            <td className="px-4 py-3 text-right font-mono">{allocation.currency} {Number(allocation.dbm_rec_amt).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            {!isViewingOnly && <td className="px-4 py-3 text-right">
                                                <Link
                                                    href={`/dbm/tier-one/${allocation.id}/edit`}
                                                    className="inline-flex items-center justify-center gap-1 rounded-md border border-border/50 bg-accent px-3 py-1.5 text-sm font-semibold text-secondary-foreground transition-all hover:bg-secondary"
                                                >
                                                    Edit <Pencil size={14} />
                                                </Link>
                                            </td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}
