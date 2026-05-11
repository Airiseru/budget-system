'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import BackButton from '@/components/ui/BackButton'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { SignButton } from '@/components/ui/digital-signatures/SignButton'
import {
    ArrowDownRight,
    ArrowUpRight,
    Check,
    ChevronDown,
    CircleMinus,
    CirclePlus,
    ShieldCheck,
} from 'lucide-react'
import type { BudgetCycle } from '@/src/types/budget_settings'
import type {
    AllocationDashboardRow,
    AllocationDashboardTotals,
} from '@/src/db/postgres/repositories/budgetAllocationRepository'
import type { Department } from '@/src/types/entities'
import type { PapOption } from '@/src/db/postgres/repositories/papRepository'
import type { ItemCatalogOption } from '@/src/db/postgres/repositories/itemRepository'
import { EXPENSE_CLASSES } from '@/src/lib/constants'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type EntityOption = {
    id: string
    entity_type: string
    name: string
    abbr: string | null
    uacs_code: string
    department_id?: string | null
    agency_id?: string | null
    parent_ou_id?: string | null
}

type FundingSourceOption = {
    code: string
    description: string | null
}

type SignoffData = {
    formId: string
    entityId: string
    authStatus: string
    signatoryRole: string
    userId: string
    codename: string
    formData: object
    signatories: {
        id: string
        user_name: string
        role: string
        created_at: Date
    }[]
    alreadySigned: boolean
    userCanSign: boolean
}

type Props = {
    activeCycle: BudgetCycle | null
    viewingYear: number | null
    availableYears: number[]
    yearLockedToActivePreparation: boolean
    rows: AllocationDashboardRow[]
    overallTotals: AllocationDashboardTotals
    filteredTotals: AllocationDashboardTotals
    departments: Department[]
    paps: PapOption[]
    entities: EntityOption[]
    items: ItemCatalogOption[]
    fundingSources: FundingSourceOption[]
    page: number
    totalPages: number
    selectedDepartmentId: string
    selectedPapId: string
    selectedExpenseClass: string
    search: string
    isFiltered: boolean
    signoff: SignoffData | null
}

type LegislativeInsertionState = {
    entity_id: string
    pap_code: string
    item_catalog_id: string
    fund_code: string
    tier: '1' | '2'
    specific_description: string
    quantity: string
    currency: string
    gaa_amt: string
    valid_from: string
    valid_until: string
}

type BulkValidityState = {
    scope: 'all' | 'expense_class' | 'expense_class_and_tier'
    expense_class: string
    tier: '1' | '2'
    valid_from: string
    valid_until: string
}

const PHASE_LABELS = {
    preparation: 'Preparation',
    dbm_review: 'DBM Review',
    presidential_approval: 'NEP',
    legislative_deliberation: 'GAA',
    enacted_gaa: 'Enacted GAA',
} as const

const generatePageNumbers = (currentPage: number, totalPages: number) => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
    if (currentPage <= 3) return [1, 2, 3, '...', totalPages]
    if (currentPage >= totalPages - 2) return [1, '...', totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', currentPage, '...', totalPages]
}

const formatAmount = (value: number) =>
    Number(value ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

const getChangeTone = (percentChange: number) => {
    const magnitude = Math.abs(percentChange)
    if (magnitude >= 50) return 'font-bold'
    if (magnitude >= 15) return 'font-semibold'
    return ''
}

const initialInsertionState: LegislativeInsertionState = {
    entity_id: '',
    pap_code: '',
    item_catalog_id: '',
    fund_code: '',
    tier: '1',
    specific_description: '',
    quantity: '1',
    currency: 'PHP',
    gaa_amt: '0',
    valid_from: '',
    valid_until: '',
}

const initialBulkValidityState: BulkValidityState = {
    scope: 'all',
    expense_class: 'all',
    tier: '1',
    valid_from: '',
    valid_until: '',
}

function getEntityLabel(entity: EntityOption) {
    return `${entity.uacs_code} • ${entity.name}`
}

function getInputKey(allocationId: string, field: string) {
    return `${allocationId}-${field}`
}

function getColumnCount(phase: BudgetCycle['current_phase'] | null) {
    if (phase === 'dbm_review') return 9
    if (phase === 'presidential_approval') return 9
    if (phase === 'legislative_deliberation') return 10
    return 10
}

function getNumericInputValue(
    inputValues: Record<string, string>,
    row: AllocationDashboardRow,
    field: 'dbm_rec_amt' | 'nep_amt' | 'gaa_amt'
) {
    const raw = inputValues[getInputKey(row.id, field)]
    if (raw === undefined || raw.trim() === '') {
        return Number(row[field] ?? 0)
    }

    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : Number(row[field] ?? 0)
}

function buildOrderedEntities(entities: EntityOption[]) {
    const departments = entities
        .filter((entity) => entity.entity_type === 'department')
        .sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))
    const agencies = entities
        .filter((entity) => entity.entity_type === 'agency')
        .sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))
    const operatingUnits = entities
        .filter((entity) => entity.entity_type === 'operating_unit')
        .sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))

    const ordered: EntityOption[] = []
    const pushOperatingUnits = (parentAgencyId: string, parentOuId: string | null = null) => {
        const matches = operatingUnits.filter((entity) =>
            entity.agency_id === parentAgencyId && (entity.parent_ou_id ?? null) === parentOuId
        )

        for (const entity of matches) {
            ordered.push(entity)
            pushOperatingUnits(parentAgencyId, entity.id)
        }
    }

    for (const department of departments) {
        ordered.push(department)
        const departmentAgencies = agencies.filter((agency) => agency.department_id === department.id)
        for (const agency of departmentAgencies) {
            ordered.push(agency)
            pushOperatingUnits(agency.id)
        }
    }

    const independentAgencies = agencies.filter((agency) => !agency.department_id)
    for (const agency of independentAgencies) {
        ordered.push(agency)
        pushOperatingUnits(agency.id)
    }

    return ordered
}

export default function AllocationDashboard({
    activeCycle,
    viewingYear,
    availableYears,
    yearLockedToActivePreparation,
    rows,
    overallTotals,
    filteredTotals,
    departments,
    paps,
    entities,
    items,
    fundingSources,
    page,
    totalPages,
    selectedDepartmentId,
    selectedPapId,
    selectedExpenseClass,
    search,
    isFiltered,
    signoff,
}: Props) {
    const router = useRouter()
    const [filtersOpen, setFiltersOpen] = useState(true)
    const [bulkValidityOpen, setBulkValidityOpen] = useState(false)
    const [legislativeInsertOpen, setLegislativeInsertOpen] = useState(false)
    const [showUacs, setShowUacs] = useState(false)
    const [selectedYear, setSelectedYear] = useState(viewingYear ? String(viewingYear) : '')
    const [departmentId, setDepartmentId] = useState(selectedDepartmentId || 'all')
    const [papId, setPapId] = useState(selectedPapId || 'all')
    const [expenseClass, setExpenseClass] = useState(selectedExpenseClass || 'all')
    const [searchValue, setSearchValue] = useState(search)
    const [rowsState, setRowsState] = useState(rows)
    const [inputValues, setInputValues] = useState<Record<string, string>>({})
    const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
    const [bulkValidity, setBulkValidity] = useState<BulkValidityState>(initialBulkValidityState)
    const [bulkValidityStatus, setBulkValidityStatus] = useState<string | null>(null)
    const [bulkValidityError, setBulkValidityError] = useState<string | null>(null)
    const [bulkValidityLoading, setBulkValidityLoading] = useState(false)
    const [insertionState, setInsertionState] = useState<LegislativeInsertionState>(initialInsertionState)
    const [insertionError, setInsertionError] = useState<string | null>(null)
    const [insertionLoading, setInsertionLoading] = useState(false)
    const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
    const currentPhase = activeCycle?.current_phase ?? null
    const sortedPaps = [...paps].sort((a, b) => a.title.localeCompare(b.title))
    const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name))
    const orderedEntities = useMemo(() => buildOrderedEntities(entities), [entities])
    const canEditDbmReview = currentPhase === 'dbm_review'
    const canEditNep = currentPhase === 'presidential_approval'
    const canEditGaa = currentPhase === 'legislative_deliberation'
    const showGaaTotals = currentPhase !== 'presidential_approval'
    const columnCount = getColumnCount(currentPhase)
    const pageDeltaTotals = useMemo(() => {
        return rowsState.reduce(
            (acc, row) => {
                const original = rows.find((entry) => entry.id === row.id)
                if (!original) return acc

                acc.dbm_rec_total += getNumericInputValue(inputValues, row, 'dbm_rec_amt') - Number(original.dbm_rec_amt ?? 0)
                acc.nep_total += getNumericInputValue(inputValues, row, 'nep_amt') - Number(original.nep_amt ?? 0)
                acc.gaa_total += getNumericInputValue(inputValues, row, 'gaa_amt') - Number(original.gaa_amt ?? 0)
                return acc
            },
            {
                dbm_rec_total: 0,
                nep_total: 0,
                gaa_total: 0,
            }
        )
    }, [inputValues, rows, rowsState])
    const displayedOverallTotals = useMemo(() => ({
        ...overallTotals,
        dbm_rec_total: overallTotals.dbm_rec_total + pageDeltaTotals.dbm_rec_total,
        nep_total: overallTotals.nep_total + pageDeltaTotals.nep_total,
        gaa_total: overallTotals.gaa_total + pageDeltaTotals.gaa_total,
    }), [overallTotals, pageDeltaTotals])
    const displayedFilteredTotals = useMemo(() => ({
        ...filteredTotals,
        dbm_rec_total: filteredTotals.dbm_rec_total + pageDeltaTotals.dbm_rec_total,
        nep_total: filteredTotals.nep_total + pageDeltaTotals.nep_total,
        gaa_total: filteredTotals.gaa_total + pageDeltaTotals.gaa_total,
    }), [filteredTotals, pageDeltaTotals])
    const nepAndGaaMismatch = displayedOverallTotals.nep_total !== displayedOverallTotals.gaa_total
    const gaaExceedsNep = displayedOverallTotals.gaa_total > displayedOverallTotals.nep_total

    useEffect(() => {
        setSelectedYear(viewingYear ? String(viewingYear) : '')
        setDepartmentId(selectedDepartmentId || 'all')
        setPapId(selectedPapId || 'all')
        setExpenseClass(selectedExpenseClass || 'all')
        setSearchValue(search)
        setRowsState(rows)
        setInputValues({})
        setSaveStates({})
    }, [rows, search, selectedDepartmentId, selectedExpenseClass, selectedPapId, viewingYear])

    const getFilterLink = (overrides: {
        year?: string
        departmentId?: string
        papId?: string
        expenseClass?: string
        search?: string
        page?: string
    } = {}) => {
        const params = new URLSearchParams()
        const nextYear = overrides.year ?? selectedYear
        const nextDepartmentId = overrides.departmentId ?? departmentId
        const nextPapId = overrides.papId ?? papId
        const nextExpenseClass = overrides.expenseClass ?? expenseClass
        const nextSearch = overrides.search ?? searchValue
        const nextPage = overrides.page ?? String(page)

        if (nextYear) params.set('year', nextYear)
        if (nextDepartmentId && nextDepartmentId !== 'all') params.set('departmentId', nextDepartmentId)
        if (nextPapId && nextPapId !== 'all') params.set('papId', nextPapId)
        if (nextExpenseClass && nextExpenseClass !== 'all') params.set('expenseClass', nextExpenseClass)
        if (nextSearch.trim()) params.set('search', nextSearch.trim())
        if (nextPage !== '1') params.set('page', nextPage)

        return `/dbm/allocations?${params.toString()}`
    }

    const updateRowState = (allocation: AllocationDashboardRow) => {
        let previousRow: AllocationDashboardRow | undefined
        setRowsState((current) => {
            previousRow = current.find((row) => row.id === allocation.id)
            return current.map((row) => (row.id === allocation.id ? { ...row, ...allocation } : row))
        })

        if (previousRow) {
            setInputValues((current) => {
                const next = { ...current }
                delete next[getInputKey(allocation.id, 'dbm_rec_amt')]
                delete next[getInputKey(allocation.id, 'nep_amt')]
                delete next[getInputKey(allocation.id, 'gaa_amt')]
                return next
            })
        }
    }

    const handleSave = (
        allocationId: string,
        field: 'dbm_rec_amt' | 'nep_amt' | 'gaa_amt' | 'valid_from' | 'valid_until',
        rawValue: string,
        action: 'update_field' | 'remove_line_item' = 'update_field'
    ) => {
        const saveKey = getInputKey(allocationId, field)
        if (timersRef.current[saveKey]) {
            clearTimeout(timersRef.current[saveKey])
        }

        setSaveStates((current) => ({ ...current, [saveKey]: 'saving' }))
        timersRef.current[saveKey] = setTimeout(async () => {
            try {
                const response = await fetch(`/api/dbm/allocations/${allocationId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                        action === 'remove_line_item'
                            ? { action }
                            : {
                                action,
                                field,
                                value: rawValue,
                            }
                    ),
                })

                const result = await response.json()
                if (!response.ok) {
                    throw new Error(result.error || 'Save failed')
                }

                updateRowState(result.allocation as AllocationDashboardRow)
                if (action === 'remove_line_item') {
                    setInputValues((current) => ({
                        ...current,
                        [getInputKey(allocationId, 'gaa_amt')]: '0',
                    }))
                }

                setSaveStates((current) => ({ ...current, [saveKey]: 'saved' }))
                setTimeout(() => {
                    setSaveStates((current) => ({ ...current, [saveKey]: 'idle' }))
                }, 2500)
            } catch {
                setSaveStates((current) => ({ ...current, [saveKey]: 'error' }))
            }
        }, 500)
    }

    const handleBulkValidityUpdate = async () => {
        setBulkValidityError(null)
        setBulkValidityStatus(null)
        setBulkValidityLoading(true)

        try {
            const response = await fetch('/api/dbm/allocations/bulk-validity', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: bulkValidity.scope,
                    expense_class: bulkValidity.expense_class === 'all' ? '' : bulkValidity.expense_class,
                    tier: bulkValidity.scope === 'expense_class_and_tier' ? bulkValidity.tier : '',
                    valid_from: bulkValidity.valid_from,
                    valid_until: bulkValidity.valid_until,
                }),
            })

            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error || 'Bulk validity update failed.')
            }

            setBulkValidityStatus(`Updated ${result.updatedCount} allocation validity records.`)
            router.refresh()
        } catch (error) {
            setBulkValidityError(error instanceof Error ? error.message : 'Bulk validity update failed.')
        } finally {
            setBulkValidityLoading(false)
        }
    }

    const handleLegislativeInsertion = async () => {
        setInsertionError(null)
        setInsertionLoading(true)

        try {
            const response = await fetch('/api/dbm/allocations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(insertionState),
            })

            const result = await response.json()
            if (!response.ok) {
                if (typeof result.error === 'object') {
                    throw new Error('Please review the legislative insertion fields.')
                }
                throw new Error(result.error || 'Failed to create legislative insertion.')
            }

            setInsertionState(initialInsertionState)
            setLegislativeInsertOpen(false)
            router.refresh()
        } catch (error) {
            setInsertionError(error instanceof Error ? error.message : 'Failed to create legislative insertion.')
        } finally {
            setInsertionLoading(false)
        }
    }

    return (
        <main className="m-6 py-10 max-w-[1800px] mx-auto space-y-6 px-4">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Budget Allocation Dashboard</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Review DBM recommendations, NEP adjustments, and GAA revisions in one place.
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <div className={`grid gap-4 ${showGaaTotals ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
                <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Viewing Year</p>
                    <p className="mt-2 text-2xl font-bold text-secondary-foreground">{viewingYear ?? '—'}</p>
                    {activeCycle && (
                        <p className="mt-1 text-sm text-muted-foreground">
                            Phase: {PHASE_LABELS[activeCycle.current_phase]}
                        </p>
                    )}
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">DBM Recommended Total</p>
                    <p className="mt-2 text-xl font-bold text-secondary-foreground">PHP {formatAmount(displayedOverallTotals.dbm_rec_total)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">NEP Total</p>
                    <p className="mt-2 text-xl font-bold text-secondary-foreground">PHP {formatAmount(displayedOverallTotals.nep_total)}</p>
                </div>
                {showGaaTotals && (
                    <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">GAA Total</p>
                        <p className={`mt-2 text-xl font-bold ${
                            gaaExceedsNep
                                ? 'text-red-700'
                                : nepAndGaaMismatch
                                    ? 'text-amber-700'
                                    : 'text-secondary-foreground'
                        }`}>
                            PHP {formatAmount(displayedOverallTotals.gaa_total)}
                        </p>
                        {nepAndGaaMismatch && (
                            <p className={`mt-1 text-sm ${gaaExceedsNep ? 'font-semibold text-red-700' : 'text-amber-700'}`}>
                                {gaaExceedsNep
                                    ? 'GAA total exceeds the NEP total.'
                                    : 'NEP and GAA totals differ.'}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {signoff && (
                <div className="rounded-xl border border-border bg-background p-6 space-y-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-secondary-foreground">
                                {signoff.formData && currentPhase === 'presidential_approval' ? 'Finalize NEP' : 'Finalize GAA'}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                A DBM approver signature locks this stage and automatically advances the budget cycle.
                            </p>
                        </div>
                        <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                            {signoff.codename}
                        </div>
                    </div>

                    {signoff.signatories.length > 0 && (
                        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2">
                            <p className="text-sm font-medium text-secondary-foreground">Current signatories</p>
                            {signoff.signatories.map((signatory) => (
                                <div key={signatory.id} className="flex items-center justify-between gap-3 text-sm">
                                    <span>{signatory.user_name}</span>
                                    <span className="text-muted-foreground">
                                        {new Intl.DateTimeFormat('en-PH', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        }).format(new Date(signatory.created_at))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {signoff.authStatus === 'approved' ? (
                        <div className="inline-flex items-center gap-2 text-emerald-700 font-medium">
                            <ShieldCheck className="h-4 w-4" />
                            Stage already signed and approved.
                        </div>
                    ) : signoff.alreadySigned ? (
                        <div className="inline-flex items-center gap-2 text-emerald-700 font-medium">
                            <ShieldCheck className="h-4 w-4" />
                            You have already signed this stage.
                        </div>
                    ) : signoff.userCanSign ? (
                        <SignButton
                            entityId={signoff.entityId}
                            tableName="budget_allocations"
                            formId={signoff.formId}
                            formData={signoff.formData}
                            userId={signoff.userId}
                            signatoryRole={signoff.signatoryRole}
                            fromAuthStatus={signoff.authStatus}
                            toAuthStatus="approved"
                            onApproved={() => router.refresh()}
                            disabled={currentPhase === 'legislative_deliberation' && gaaExceedsNep}
                            disabledMessage={
                                currentPhase === 'legislative_deliberation' && gaaExceedsNep
                                    ? 'GAA sign-off is blocked while the GAA total exceeds the NEP total.'
                                    : undefined
                            }
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground italic">
                            Only DBM approvers can sign this stage.
                        </p>
                    )}
                </div>
            )}

            {canEditGaa && (
                <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setBulkValidityOpen((open) => !open)}
                            className={`w-full px-4 py-4 flex items-center justify-between text-left ${bulkValidityOpen ? 'border-b border-border' : ''}`}
                        >
                            <div>
                                <h2 className="text-lg font-semibold text-secondary-foreground">Bulk Validity</h2>
                                <p className="text-sm text-muted-foreground">
                                    Apply validity dates to all line items, one expense class, or an expense class and tier.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{bulkValidityOpen ? 'Hide' : 'Show'}</span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${bulkValidityOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </button>

                        {bulkValidityOpen && (
                            <div className="px-4 py-4 space-y-4">
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="space-y-2">
                                        <p className="font-medium">Scope</p>
                                        <Select
                                            value={bulkValidity.scope}
                                            onValueChange={(value) =>
                                                setBulkValidity((current) => ({
                                                    ...current,
                                                    scope: (value ?? 'all') as BulkValidityState['scope'],
                                                }))
                                            }
                                        >
                                            <SelectTrigger className="w-full border-border text-md">
                                                <SelectValue>
                                                    {bulkValidity.scope === 'all'
                                                        ? 'All line items'
                                                        : bulkValidity.scope === 'expense_class'
                                                            ? 'Expense class only'
                                                            : 'Expense class and tier'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All line items</SelectItem>
                                                <SelectItem value="expense_class">Expense class only</SelectItem>
                                                <SelectItem value="expense_class_and_tier">Expense class and tier</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Expense Class</p>
                                        <Select
                                            value={bulkValidity.expense_class}
                                            onValueChange={(value) =>
                                                setBulkValidity((current) => ({
                                                    ...current,
                                                    expense_class: value ?? 'all',
                                                }))
                                            }
                                            disabled={bulkValidity.scope === 'all'}
                                        >
                                            <SelectTrigger className="w-full border-border text-md">
                                                <SelectValue>
                                                    {bulkValidity.expense_class === 'all'
                                                        ? 'All expense classes'
                                                        : `${bulkValidity.expense_class} • ${EXPENSE_CLASSES[bulkValidity.expense_class] ?? bulkValidity.expense_class}`}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All expense classes</SelectItem>
                                                {Object.entries(EXPENSE_CLASSES).map(([code, label]) => (
                                                    <SelectItem key={code} value={code}>
                                                        {code} • {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Tier</p>
                                        <Select
                                            value={bulkValidity.tier}
                                            onValueChange={(value) =>
                                                setBulkValidity((current) => ({
                                                    ...current,
                                                    tier: (value ?? '1') as '1' | '2',
                                                }))
                                            }
                                            disabled={bulkValidity.scope !== 'expense_class_and_tier'}
                                        >
                                            <SelectTrigger className="w-full border-border text-md">
                                                <SelectValue>
                                                    {bulkValidity.tier === '1' ? 'Tier 1' : 'Tier 2'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">Tier 1</SelectItem>
                                                <SelectItem value="2">Tier 2</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Valid From</p>
                                        <input
                                            type="date"
                                            value={bulkValidity.valid_from}
                                            onChange={(event) =>
                                                setBulkValidity((current) => ({ ...current, valid_from: event.target.value }))
                                            }
                                            className="w-full rounded-md border border-border bg-background px-3 py-2"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Valid Until</p>
                                        <input
                                            type="date"
                                            value={bulkValidity.valid_until}
                                            onChange={(event) =>
                                                setBulkValidity((current) => ({ ...current, valid_until: event.target.value }))
                                            }
                                            className="w-full rounded-md border border-border bg-background px-3 py-2"
                                        />
                                    </div>
                                </div>
                                {bulkValidityError && <p className="text-sm text-red-700">{bulkValidityError}</p>}
                                {bulkValidityStatus && <p className="text-sm text-emerald-700">{bulkValidityStatus}</p>}
                                <Button
                                    type="button"
                                    onClick={handleBulkValidityUpdate}
                                    disabled={bulkValidityLoading}
                                    className="bg-accent-foreground text-white hover:bg-accent-foreground/90"
                                >
                                    {bulkValidityLoading ? 'Applying...' : 'Apply Bulk Validity'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="rounded-lg border border-border bg-background overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setLegislativeInsertOpen((open) => !open)}
                            className={`w-full px-4 py-4 flex items-center justify-between text-left ${legislativeInsertOpen ? 'border-b border-border' : ''}`}
                        >
                            <div>
                                <h2 className="text-lg font-semibold text-secondary-foreground">Legislative Insertion</h2>
                                <p className="text-sm text-muted-foreground">
                                    Add a new GAA line item with an origin tag of legislative insertion.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{legislativeInsertOpen ? 'Hide' : 'Show'}</span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${legislativeInsertOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </button>

                        {legislativeInsertOpen && (
                            <div className="px-4 py-4 space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <p className="font-medium">Entity</p>
                                        <Select
                                            value={insertionState.entity_id}
                                            onValueChange={(value) =>
                                                setInsertionState((current) => ({ ...current, entity_id: value ?? '' }))
                                            }
                                        >
                                            <SelectTrigger className="w-full border-border text-md">
                                                <SelectValue placeholder="Select entity">
                                                    {insertionState.entity_id
                                                        ? getEntityLabel(entities.find((entity) => entity.id === insertionState.entity_id) ?? {
                                                            id: '',
                                                            entity_type: '',
                                                            name: 'Select entity',
                                                            abbr: null,
                                                            uacs_code: '',
                                                        })
                                                        : 'Select entity'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {orderedEntities.map((entity) => (
                                                    <SelectItem key={entity.id} value={entity.id}>
                                                        {getEntityLabel(entity)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">PAP</p>
                                        <Select
                                            value={insertionState.pap_code}
                                            onValueChange={(value) =>
                                                setInsertionState((current) => ({ ...current, pap_code: value ?? '' }))
                                            }
                                        >
                                            <SelectTrigger className="w-full border-border text-md">
                                                <SelectValue placeholder="Select PAP">
                                                    {(() => {
                                                        const pap = sortedPaps.find((entry) => entry.id === insertionState.pap_code)
                                                        if (!pap) return 'Select PAP'
                                                        return pap.entity_name ? `${pap.title} • ${pap.entity_name}` : `${pap.title} • All entities`
                                                    })()}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sortedPaps.map((pap) => (
                                                    <SelectItem key={pap.id} value={pap.id}>
                                                        {pap.entity_name ? `${pap.title} • ${pap.entity_name}` : `${pap.title} • All entities`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Item Catalog</p>
                                        <Select
                                            value={insertionState.item_catalog_id}
                                            onValueChange={(value) =>
                                                setInsertionState((current) => ({ ...current, item_catalog_id: value ?? '' }))
                                            }
                                        >
                                            <SelectTrigger className="w-full border-border text-md">
                                                <SelectValue placeholder="Select line item">
                                                    {sortedItems.find((item) => item.id === insertionState.item_catalog_id)?.name ?? 'Select line item'}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sortedItems.map((item) => (
                                                    <SelectItem key={item.id} value={item.id}>
                                                        {item.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Fund Source</p>
                                        <Select
                                            value={insertionState.fund_code}
                                            onValueChange={(value) =>
                                                setInsertionState((current) => ({ ...current, fund_code: value ?? '' }))
                                            }
                                        >
                                            <SelectTrigger className="w-full border-border text-md">
                                                <SelectValue placeholder="Select fund source">
                                                    {(() => {
                                                        const fund = fundingSources.find((entry) => entry.code === insertionState.fund_code)
                                                        if (!fund) return 'Select fund source'
                                                        return fund.description ? `${fund.code} • ${fund.description}` : fund.code
                                                    })()}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fundingSources.map((fund) => (
                                                    <SelectItem key={fund.code} value={fund.code}>
                                                        {fund.description ? `${fund.code} • ${fund.description}` : fund.code}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Tier</p>
                                        <Select
                                            value={insertionState.tier}
                                            onValueChange={(value) =>
                                                setInsertionState((current) => ({
                                                    ...current,
                                                    tier: (value ?? '1') as '1' | '2',
                                                }))
                                            }
                                        >
                                            <SelectTrigger className="w-full border-border text-md">
                                                <SelectValue>{insertionState.tier === '1' ? 'Tier 1' : 'Tier 2'}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">Tier 1</SelectItem>
                                                <SelectItem value="2">Tier 2</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Quantity</p>
                                        <input
                                            value={insertionState.quantity}
                                            onChange={(event) =>
                                                setInsertionState((current) => ({ ...current, quantity: event.target.value }))
                                            }
                                            className="w-full rounded-md border border-border bg-background px-3 py-2"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">GAA Amount</p>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={insertionState.gaa_amt}
                                            onChange={(event) =>
                                                setInsertionState((current) => ({ ...current, gaa_amt: event.target.value }))
                                            }
                                            className="w-full rounded-md border border-border bg-background px-3 py-2"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Currency</p>
                                        <input
                                            value={insertionState.currency}
                                            onChange={(event) =>
                                                setInsertionState((current) => ({ ...current, currency: event.target.value }))
                                            }
                                            className="w-full rounded-md border border-border bg-background px-3 py-2"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Valid From</p>
                                        <input
                                            type="date"
                                            value={insertionState.valid_from}
                                            onChange={(event) =>
                                                setInsertionState((current) => ({ ...current, valid_from: event.target.value }))
                                            }
                                            className="w-full rounded-md border border-border bg-background px-3 py-2"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-medium">Valid Until</p>
                                        <input
                                            type="date"
                                            value={insertionState.valid_until}
                                            onChange={(event) =>
                                                setInsertionState((current) => ({ ...current, valid_until: event.target.value }))
                                            }
                                            className="w-full rounded-md border border-border bg-background px-3 py-2"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="font-medium">Specific Description</p>
                                    <textarea
                                        value={insertionState.specific_description}
                                        onChange={(event) =>
                                            setInsertionState((current) => ({
                                                ...current,
                                                specific_description: event.target.value,
                                            }))
                                        }
                                        className="w-full rounded-md border border-border bg-background px-3 py-2 min-h-24"
                                    />
                                </div>
                                {insertionError && <p className="text-sm text-red-700">{insertionError}</p>}
                                <Button
                                    type="button"
                                    onClick={handleLegislativeInsertion}
                                    disabled={insertionLoading}
                                    className="bg-emerald-700 text-white hover:bg-emerald-700/90"
                                >
                                    {insertionLoading ? 'Creating...' : 'Create Legislative Insertion'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="rounded-lg border border-border bg-background overflow-hidden">
                <button
                    type="button"
                    onClick={() => setFiltersOpen((open) => !open)}
                    className={`w-full px-4 py-4 flex items-center justify-between text-left ${filtersOpen ? 'border-b border-border' : ''}`}
                >
                    <div>
                        <h2 className="text-lg font-semibold text-secondary-foreground">Filters</h2>
                        <p className="text-sm text-muted-foreground">
                            Filter the allocation table by year, department, PAP, expense class, or line item search.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{filtersOpen ? 'Hide' : 'Show'}</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                    </div>
                </button>

                {filtersOpen && (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault()
                            router.push(getFilterLink({ page: '1' }))
                        }}
                        className="px-4 py-4 flex flex-col gap-4"
                    >
                        <div className="flex flex-wrap gap-4 2xl:flex-nowrap">
                            <div className="space-y-2 w-full sm:w-[220px] lg:flex-1 lg:min-w-[200px] lg:max-w-[260px]">
                                <p className="font-medium">Year</p>
                                <Select value={selectedYear} onValueChange={(value) => setSelectedYear(value ?? '')} disabled={yearLockedToActivePreparation}>
                                    <SelectTrigger className="w-full border-border text-md">
                                        <SelectValue placeholder="Select year">
                                            {selectedYear ? `FY ${selectedYear}` : 'Select year'}
                                        </SelectValue>
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
                            <div className="space-y-2 w-full lg:flex-[1.25] lg:min-w-[260px] lg:max-w-[380px]">
                                <p className="font-medium">Department</p>
                                <Select value={departmentId} onValueChange={(value) => setDepartmentId(value ?? 'all')}>
                                    <SelectTrigger className="w-full border-border text-md">
                                        <SelectValue placeholder="All departments">
                                            {departmentId === 'all'
                                                ? 'All departments'
                                                : departments.find((department) => department.id === departmentId)?.name}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All departments</SelectItem>
                                        {departments.map((department) => (
                                            <SelectItem key={department.id} value={department.id}>
                                                {department.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 w-full lg:flex-[1.25] lg:min-w-[260px] lg:max-w-[420px]">
                                <p className="font-medium">PAP</p>
                                <Select value={papId} onValueChange={(value) => setPapId(value ?? 'all')}>
                                    <SelectTrigger className="w-full border-border text-md">
                                        <SelectValue placeholder="All PAPs">
                                            {papId === 'all'
                                                ? 'All PAPs'
                                                : (() => {
                                                    const pap = sortedPaps.find((entry) => entry.id === papId)
                                                    if (!pap) return 'All PAPs'
                                                    return pap.entity_name ? `${pap.title} • ${pap.entity_name}` : `${pap.title} • All entities`
                                                })()}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All PAPs</SelectItem>
                                        {sortedPaps.map((pap) => (
                                            <SelectItem key={pap.id} value={pap.id}>
                                                {pap.entity_name ? `${pap.title} • ${pap.entity_name}` : `${pap.title} • All entities`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 w-full sm:w-[220px] lg:flex-1 lg:min-w-[200px] lg:max-w-[260px]">
                                <p className="font-medium">Expense Class</p>
                                <Select value={expenseClass} onValueChange={(value) => setExpenseClass(value ?? 'all')}>
                                    <SelectTrigger className="w-full border-border text-md">
                                        <SelectValue placeholder="All expense classes">
                                            {expenseClass === 'all' ? 'All expense classes' : `${expenseClass} • ${EXPENSE_CLASSES[expenseClass] ?? expenseClass}`}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All expense classes</SelectItem>
                                        {Object.entries(EXPENSE_CLASSES).map(([code, label]) => (
                                            <SelectItem key={code} value={code}>
                                                {code} • {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 w-full lg:flex-[1.2] lg:min-w-[260px] lg:max-w-[360px]">
                                <p className="font-medium">Search Item</p>
                                <input
                                    value={searchValue}
                                    onChange={(event) => setSearchValue(event.target.value)}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    placeholder="Search item catalog name"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button type="submit" className="bg-accent-foreground text-white hover:bg-accent-foreground/90">
                                    Apply Filters
                                </Button>
                                <Link
                                    href={`/dbm/allocations${yearLockedToActivePreparation && selectedYear ? `?year=${selectedYear}` : ''}`}
                                    className="text-sm text-muted-foreground hover:text-secondary-foreground underline underline-offset-2 h-[38px] flex items-center"
                                >
                                    Clear
                                </Link>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={showUacs}
                                    onChange={(event) => setShowUacs(event.target.checked)}
                                />
                                Show UACS
                            </label>
                        </div>
                    </form>
                )}
            </div>

            <div className="rounded-xl border border-border bg-background overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-secondary/30 border-b border-border/30 text-sm uppercase text-muted-foreground font-bold tracking-wider">
                            <tr>
                                <th className="px-4 py-3">Department</th>
                                <th className="px-4 py-3">Agency</th>
                                <th className="px-4 py-3">Operating Unit</th>
                                <th className="px-4 py-3">Fund Source</th>
                                <th className="px-4 py-3">Expense Class</th>
                                <th className="px-4 py-3">Line Item</th>
                                {canEditDbmReview && (
                                    <>
                                        <th className="px-4 py-3 text-right">Proposed</th>
                                        <th className="px-4 py-3 text-right">DBM Rec</th>
                                    </>
                                )}
                                {canEditNep && (
                                    <>
                                        <th className="px-4 py-3 text-right">DBM Rec</th>
                                        <th className="px-4 py-3 text-right">NEP</th>
                                    </>
                                )}
                                {canEditGaa && (
                                    <>
                                        <th className="px-4 py-3 text-right">NEP</th>
                                        <th className="px-4 py-3 text-right">GAA</th>
                                        <th className="px-4 py-3">Validity</th>
                                    </>
                                )}
                                {(!currentPhase || currentPhase === 'preparation' || currentPhase === 'enacted_gaa') && (
                                    <>
                                        <th className="px-4 py-3 text-right">DBM Rec</th>
                                        <th className="px-4 py-3 text-right">NEP</th>
                                        <th className="px-4 py-3 text-right">GAA</th>
                                    </>
                                )}
                                <th className="px-4 py-3 text-right">Prev Year Diff</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {rowsState.length === 0 ? (
                                <tr>
                                    <td colSpan={columnCount} className="px-4 py-10 text-center text-muted-foreground">
                                        No allocations found for the selected filters.
                                    </td>
                                </tr>
                            ) : rowsState.map((row, index) => {
                                const previousRow = rowsState[index - 1]
                                const nextRow = rowsState[index + 1]
                                const currentGroupKey = [
                                    row.department_id ?? 'none',
                                    row.agency_id ?? 'none',
                                    row.operating_unit_id ?? 'none',
                                    row.pap_project_type ?? 'none',
                                    row.pap_title ?? 'No PAP',
                                ].join('|')
                                const previousGroupKey = previousRow ? [
                                    previousRow.department_id ?? 'none',
                                    previousRow.agency_id ?? 'none',
                                    previousRow.operating_unit_id ?? 'none',
                                    previousRow.pap_project_type ?? 'none',
                                    previousRow.pap_title ?? 'No PAP',
                                ].join('|') : null
                                const nextGroupKey = nextRow ? [
                                    nextRow.department_id ?? 'none',
                                    nextRow.agency_id ?? 'none',
                                    nextRow.operating_unit_id ?? 'none',
                                    nextRow.pap_project_type ?? 'none',
                                    nextRow.pap_title ?? 'No PAP',
                                ].join('|') : null
                                const shouldShowDivider = currentGroupKey !== previousGroupKey
                                const shouldShowSubtotal = currentGroupKey !== nextGroupKey
                                const activeAmount =
                                    canEditNep
                                        ? Number(row.nep_amt)
                                        : canEditGaa
                                            ? Number(row.gaa_amt)
                                            : Number(row.dbm_rec_amt)
                                const percentDiff = Number(row.prev_year_gaa_amt) === 0
                                    ? null
                                    : ((activeAmount - Number(row.prev_year_gaa_amt)) / Number(row.prev_year_gaa_amt)) * 100
                                const nepAmount = Number(row.nep_amt)
                                const gaaAmount = Number(row.gaa_amt)
                                const nepVsGaaDiff =
                                    nepAmount === 0
                                        ? (gaaAmount === 0 ? 0 : 100)
                                        : ((gaaAmount - nepAmount) / nepAmount) * 100
                                const hasNoNepToGaaChange = nepVsGaaDiff !== null && Math.abs(nepVsGaaDiff) < 0.0001
                                const removedInGaa = canEditGaa && Number(row.gaa_amt) === 0
                                const legislativeInsertion = row.origin_tag === 'legislative_insertion'
                                const groupRows = rowsState.filter((entry) => {
                                    const entryKey = [
                                        entry.department_id ?? 'none',
                                        entry.agency_id ?? 'none',
                                        entry.operating_unit_id ?? 'none',
                                        entry.pap_project_type ?? 'none',
                                        entry.pap_title ?? 'No PAP',
                                    ].join('|')
                                    return entryKey === currentGroupKey
                                })
                                const groupSubtotal = groupRows.reduce(
                                    (acc, entry) => {
                                        acc.proposed_total += Number(entry.proposed_amt ?? 0)
                                        acc.dbm_rec_total += getNumericInputValue(inputValues, entry, 'dbm_rec_amt')
                                        acc.nep_total += getNumericInputValue(inputValues, entry, 'nep_amt')
                                        acc.gaa_total += getNumericInputValue(inputValues, entry, 'gaa_amt')
                                        return acc
                                    },
                                    {
                                        proposed_total: 0,
                                        dbm_rec_total: 0,
                                        nep_total: 0,
                                        gaa_total: 0,
                                    }
                                )

                                return (
                                    <Fragment key={row.id}>
                                        {shouldShowDivider && (
                                            <tr className="bg-accent/20 border-y border-border">
                                                <td colSpan={columnCount} className="px-4 py-3 bg-accent/20 border-y border-border">
                                                    <div className="font-semibold text-secondary-foreground">
                                                        {(row.pap_project_type ?? 'Unclassified Project').toUpperCase()} • {row.pap_title ?? 'No PAP'}
                                                    </div>
                                                    {showUacs && row.pap_uacs_code && (
                                                        <div className="text-xs text-muted-foreground mt-1">
                                                            PREXC FPAP ID: {row.pap_uacs_code}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                        <tr className={removedInGaa ? 'bg-red-50/40' : ''}>
                                            <td className="px-4 py-3">
                                                <div>{row.department_name ?? '00'}</div>
                                                {showUacs && <div className="text-xs text-muted-foreground">{row.department_uacs_code ?? '00'}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>{row.agency_name ?? '000'}</div>
                                                {showUacs && <div className="text-xs text-muted-foreground">{row.agency_uacs_code ?? '000'}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>{row.operating_unit_name ?? '0000000'}</div>
                                                {showUacs && <div className="text-xs text-muted-foreground">{row.operating_unit_uacs_code ?? '0000000'}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>{row.fund_description ?? row.fund_code ?? 'No fund source'}</div>
                                                {showUacs && <div className="text-xs text-muted-foreground">{row.fund_code ?? '—'}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>{row.expense_class}</div>
                                                {showUacs && <div className="text-xs text-muted-foreground">{row.expense_class_code}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-1">
                                                    <div>{row.item_name}</div>
                                                    {showUacs && <div className="text-xs text-muted-foreground mt-1">{row.object_code}</div>}
                                                    <div className="flex flex-wrap gap-2">
                                                        {legislativeInsertion && (
                                                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">
                                                                <CirclePlus className="h-5 w-5" />
                                                                Legislative insertion
                                                            </span>
                                                        )}
                                                        {removedInGaa && (
                                                            <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">
                                                                <CircleMinus className="h-4 w-4" />
                                                                Removed in GAA
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {canEditDbmReview && (
                                                <>
                                                    <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.proposed_amt))}</td>
                                                    <td className="px-4 py-3 text-right">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={inputValues[getInputKey(row.id, 'dbm_rec_amt')] ?? String(row.dbm_rec_amt)}
                                                            onChange={(event) =>
                                                                setInputValues((current) => ({
                                                                    ...current,
                                                                    [getInputKey(row.id, 'dbm_rec_amt')]: event.target.value,
                                                                }))
                                                            }
                                                            onBlur={(event) => handleSave(row.id, 'dbm_rec_amt', event.target.value)}
                                                            className="w-[160px] rounded-md border border-border bg-background px-3 py-2 text-right font-mono"
                                                        />
                                                        {saveStates[getInputKey(row.id, 'dbm_rec_amt')] === 'saved' && (
                                                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3 w-3" /> Saved</span>
                                                        )}
                                                    </td>
                                                </>
                                            )}

                                            {canEditNep && (
                                                <>
                                                    <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.dbm_rec_amt))}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={inputValues[getInputKey(row.id, 'nep_amt')] ?? String(row.nep_amt)}
                                                            onChange={(event) =>
                                                                setInputValues((current) => ({
                                                                    ...current,
                                                                    [getInputKey(row.id, 'nep_amt')]: event.target.value,
                                                                }))
                                                            }
                                                            onBlur={(event) => handleSave(row.id, 'nep_amt', event.target.value)}
                                                            className="w-[160px] rounded-md border border-border bg-background px-3 py-2 text-right font-mono"
                                                        />
                                                        {saveStates[getInputKey(row.id, 'nep_amt')] === 'saved' && (
                                                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3 w-3" /> Saved</span>
                                                        )}
                                                    </td>
                                                </>
                                            )}

                                            {canEditGaa && (
                                                <>
                                                    <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.nep_amt))}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={inputValues[getInputKey(row.id, 'gaa_amt')] ?? String(row.gaa_amt)}
                                                                onChange={(event) =>
                                                                    setInputValues((current) => ({
                                                                        ...current,
                                                                        [getInputKey(row.id, 'gaa_amt')]: event.target.value,
                                                                    }))
                                                                }
                                                                onBlur={(event) => handleSave(row.id, 'gaa_amt', event.target.value)}
                                                                className="w-[160px] rounded-md border border-border bg-background px-3 py-2 text-right font-mono"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSave(row.id, 'gaa_amt', '0', 'remove_line_item')}
                                                                className="rounded-md border border-red-300 px-2 py-2 text-red-700 hover:bg-red-50"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                        <div className="mt-1 flex items-center justify-end gap-2">
                                                            {saveStates[getInputKey(row.id, 'gaa_amt')] === 'saved' && (
                                                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3 w-3" /> Saved</span>
                                                            )}
                                                            { (!hasNoNepToGaaChange && (nepVsGaaDiff != null)) && (
                                                                <span className={`inline-flex items-center gap-1 text-xs ${nepVsGaaDiff >= 0 ? 'text-emerald-700' : 'text-red-700'} ${getChangeTone(nepVsGaaDiff)}`}>
                                                                    {nepVsGaaDiff >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                                    {Math.abs(nepVsGaaDiff).toFixed(1)}% vs NEP
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="date"
                                                                value={inputValues[getInputKey(row.id, 'valid_from')] ?? (row.valid_from ? new Date(row.valid_from).toISOString().split('T')[0] : '')}
                                                                onChange={(event) =>
                                                                    setInputValues((current) => ({
                                                                        ...current,
                                                                        [getInputKey(row.id, 'valid_from')]: event.target.value,
                                                                    }))
                                                                }
                                                                onBlur={(event) => handleSave(row.id, 'valid_from', event.target.value)}
                                                                className="rounded-md border border-border bg-background px-2 py-2 text-xs"
                                                            />
                                                            <input
                                                                type="date"
                                                                value={inputValues[getInputKey(row.id, 'valid_until')] ?? (row.valid_until ? new Date(row.valid_until).toISOString().split('T')[0] : '')}
                                                                onChange={(event) =>
                                                                    setInputValues((current) => ({
                                                                        ...current,
                                                                        [getInputKey(row.id, 'valid_until')]: event.target.value,
                                                                    }))
                                                                }
                                                                onBlur={(event) => handleSave(row.id, 'valid_until', event.target.value)}
                                                                className="rounded-md border border-border bg-background px-2 py-2 text-xs"
                                                            />
                                                        </div>
                                                    </td>
                                                </>
                                            )}

                                            {(!currentPhase || currentPhase === 'preparation' || currentPhase === 'enacted_gaa') && (
                                                <>
                                                    <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.dbm_rec_amt))}</td>
                                                    <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.nep_amt))}</td>
                                                    <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.gaa_amt))}</td>
                                                </>
                                            )}

                                            <td className="px-4 py-3 text-right">
                                                {percentDiff == null ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1 ${percentDiff >= 0 ? 'text-emerald-700' : 'text-red-700'} ${getChangeTone(percentDiff)}`}>
                                                        {percentDiff >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                                        {Math.abs(percentDiff).toFixed(1)}%
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                        {shouldShowSubtotal && (
                                            <tr className="bg-muted/30 border-y border-border/30">
                                                <td colSpan={6} className="px-4 py-3 text-right font-semibold text-secondary-foreground">
                                                    PAP subtotal
                                                </td>
                                                {canEditDbmReview && (
                                                    <>
                                                        <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                            PHP {formatAmount(groupSubtotal.proposed_total)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                            PHP {formatAmount(groupSubtotal.dbm_rec_total)}
                                                        </td>
                                                    </>
                                                )}
                                                {canEditNep && (
                                                    <>
                                                        <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                            PHP {formatAmount(groupSubtotal.dbm_rec_total)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                            PHP {formatAmount(groupSubtotal.nep_total)}
                                                        </td>
                                                    </>
                                                )}
                                                {canEditGaa && (
                                                    <>
                                                        <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                            PHP {formatAmount(groupSubtotal.nep_total)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                            PHP {formatAmount(groupSubtotal.gaa_total)}
                                                        </td>
                                                        <td className="px-4 py-3" />
                                                    </>
                                                )}
                                                {(!currentPhase || currentPhase === 'preparation' || currentPhase === 'enacted_gaa') && (
                                                    <>
                                                        <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                            PHP {formatAmount(groupSubtotal.dbm_rec_total)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                            PHP {formatAmount(groupSubtotal.nep_total)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                            PHP {formatAmount(groupSubtotal.gaa_total)}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="px-4 py-3" />
                                            </tr>
                                        )}
                                    </Fragment>
                                )
                            })}
                        </tbody>
                        {isFiltered && (
                            <tfoot className="bg-muted/40 border-t border-border/40">
                                <tr>
                                    <td colSpan={6} className="px-4 py-3 text-right font-semibold text-secondary-foreground">
                                        Filtered subtotal
                                    </td>
                                    {canEditDbmReview && (
                                        <>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                                PHP {formatAmount(filteredTotals.proposed_total)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                                PHP {formatAmount(displayedFilteredTotals.dbm_rec_total)}
                                            </td>
                                        </>
                                    )}
                                    {canEditNep && (
                                        <>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                                PHP {formatAmount(displayedFilteredTotals.dbm_rec_total)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                                PHP {formatAmount(displayedFilteredTotals.nep_total)}
                                            </td>
                                        </>
                                    )}
                                    {canEditGaa && (
                                        <>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                                PHP {formatAmount(displayedFilteredTotals.nep_total)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                                PHP {formatAmount(displayedFilteredTotals.gaa_total)}
                                            </td>
                                            <td className="px-4 py-3" />
                                        </>
                                    )}
                                    {(!currentPhase || currentPhase === 'preparation' || currentPhase === 'enacted_gaa') && (
                                        <>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                                PHP {formatAmount(displayedFilteredTotals.dbm_rec_total)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                                PHP {formatAmount(displayedFilteredTotals.nep_total)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                                PHP {formatAmount(displayedFilteredTotals.gaa_total)}
                                            </td>
                                        </>
                                    )}
                                    <td className="px-4 py-3" />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                <div className="bg-muted border-t border-border/30 p-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing page <span className="font-bold">{page}</span> of <span className="font-bold">{totalPages !== 0 ? totalPages : 1}</span>
                    </p>
                    <div className="flex gap-1 items-center">
                        <Link
                            href={page > 1 ? getFilterLink({ page: String(page - 1) }) : '#'}
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
                                    href={getFilterLink({ page: String(current) })}
                                    className={`px-3 py-1.5 border-b rounded text-sm font-bold transition-colors ${
                                        page === current
                                            ? 'bg-secondary-foreground text-accent border-secondary-foreground'
                                            : 'border-border/50 bg-accent text-secondary-foreground hover:bg-secondary'
                                    }`}
                                >
                                    {current}
                                </Link>
                            )
                        ))}
                        <Link
                            href={page < totalPages ? getFilterLink({ page: String(page + 1) }) : '#'}
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
