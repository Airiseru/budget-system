'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CirclePlus } from 'lucide-react'
import BackButton from '@/components/ui/BackButton'
import VerifyAllocationSignoffIntegrityDialog from '@/components/ui/audit/VerifyAllocationSignoffIntegrityDialog'
import { Button } from '@/components/ui/button'
import FloatingStatus, { type FloatingStatusMessage } from '@/components/ui/FloatingStatus'
import type { AllocationDashboardRow } from '@/src/db/postgres/repositories/budgetAllocationRepository'
import type { AllocationDashboardProps, BulkValidityState, LegislativeInsertionState } from './allocation-dashboard/shared'
import {
    buildOrderedEntities,
    getColumnCount,
    getInputKey,
    getNumericInputValue,
    initialBulkValidityState,
    initialInsertionState,
} from './allocation-dashboard/shared'
import StickySummaryHeader from './allocation-dashboard/StickySummaryHeader'
import AllocationSignoffPanel from './allocation-dashboard/AllocationSignoffPanel'
import BulkValidityPanel from './allocation-dashboard/BulkValidityPanel'
import AllocationFiltersPanel from './allocation-dashboard/AllocationFiltersPanel'
import LegislativeInsertionDialog from './allocation-dashboard/LegislativeInsertionDialog'
import AllocationTable from './allocation-dashboard/AllocationTable'
import AllocationHistoryDrawer from './allocation-dashboard/AllocationHistoryDrawer'
import AllocationBudgetSummary from './allocation-dashboard/AllocationBudgetSummary'

export default function AllocationDashboard({
    activeCycle,
    viewingYear,
    availableYears,
    yearLockedToActivePreparation,
    rows,
    overallTotals,
    filteredTotals,
    hierarchySummaries,
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
    includeDbmRejectedLineItems,
    isFiltered,
    signoff,
}: AllocationDashboardProps) {
    const router = useRouter()
    const [filtersOpen, setFiltersOpen] = useState(true)
    const [activeView, setActiveView] = useState<'line_items' | 'summary'>('line_items')
    const [bulkValidityOpen, setBulkValidityOpen] = useState(false)
    const [showUacs, setShowUacs] = useState(false)
    const [legislativeInsertOpen, setLegislativeInsertOpen] = useState(false)
    const [selectedYear, setSelectedYear] = useState(viewingYear ? String(viewingYear) : '')
    const [departmentId, setDepartmentId] = useState(selectedDepartmentId || 'all')
    const [papId, setPapId] = useState(selectedPapId || 'all')
    const [expenseClass, setExpenseClass] = useState(selectedExpenseClass || 'all')
    const [searchValue, setSearchValue] = useState(search)
    const [showDbmRejectedLineItems, setShowDbmRejectedLineItems] = useState(includeDbmRejectedLineItems)
    const [rowsState, setRowsState] = useState(rows)
    const [inputValues, setInputValues] = useState<Record<string, string>>({})
    const [saveStates, setSaveStates] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})
    const [bulkValidity, setBulkValidity] = useState<BulkValidityState>(initialBulkValidityState)
    const [bulkValidityStatus, setBulkValidityStatus] = useState<string | null>(null)
    const [bulkValidityError, setBulkValidityError] = useState<string | null>(null)
    const [bulkValidityLoading, setBulkValidityLoading] = useState(false)
    const [insertionState, setInsertionState] = useState<LegislativeInsertionState>(initialInsertionState)
    const [insertionError, setInsertionError] = useState<string | null>(null)
    const [insertionLoading, setInsertionLoading] = useState(false)
    const [historyRow, setHistoryRow] = useState<AllocationDashboardRow | null>(null)
    const [floatingStatus, setFloatingStatus] = useState<FloatingStatusMessage>(null)
    const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
    const currentPhase = activeCycle?.current_phase ?? null
    const canEditGaa = currentPhase === 'legislative_deliberation'
    const showGaaTotals = currentPhase !== 'presidential_approval'
    const columnCount = getColumnCount(currentPhase)

    const orderedEntities = useMemo(() => buildOrderedEntities(entities), [entities])

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

    const gaaExceedsNep = displayedOverallTotals.gaa_total > displayedOverallTotals.nep_total
    const integrityTargets = useMemo(() => {
        if (!viewingYear) return [] as Array<'nep' | 'gaa'>

        const isActiveYear = !!activeCycle && viewingYear === activeCycle.fiscal_year
        if (!isActiveYear) {
            return ['nep', 'gaa'] satisfies Array<'nep' | 'gaa'>
        }

        if (currentPhase === 'presidential_approval') {
            return ['nep'] satisfies Array<'nep' | 'gaa'>
        }

        if (currentPhase === 'legislative_deliberation' || currentPhase === 'enacted_gaa') {
            return ['nep', 'gaa'] satisfies Array<'nep' | 'gaa'>
        }

        return [] as Array<'nep' | 'gaa'>
    }, [activeCycle, currentPhase, viewingYear])

    useEffect(() => {
        setSelectedYear(viewingYear ? String(viewingYear) : '')
        setDepartmentId(selectedDepartmentId || 'all')
        setPapId(selectedPapId || 'all')
        setExpenseClass(selectedExpenseClass || 'all')
        setSearchValue(search)
        setShowDbmRejectedLineItems(includeDbmRejectedLineItems)
        setRowsState(rows)
        setInputValues({})
        setSaveStates({})
    }, [includeDbmRejectedLineItems, rows, search, selectedDepartmentId, selectedExpenseClass, selectedPapId, viewingYear])

    useEffect(() => {
        const timers = timersRef.current
        return () => {
            Object.values(timers).forEach((timer) => clearTimeout(timer))
        }
    }, [])

    const getFilterLink = (overrides: {
        year?: string
        departmentId?: string
        papId?: string
        expenseClass?: string
        search?: string
        includeDbmRejectedLineItems?: string
        page?: string
    } = {}) => {
        const params = new URLSearchParams()
        const nextYear = overrides.year ?? selectedYear
        const nextDepartmentId = overrides.departmentId ?? departmentId
        const nextPapId = overrides.papId ?? papId
        const nextExpenseClass = overrides.expenseClass ?? expenseClass
        const nextSearch = overrides.search ?? searchValue
        const nextIncludeDbmRejectedLineItems = overrides.includeDbmRejectedLineItems ?? (showDbmRejectedLineItems ? 'true' : 'false')
        const nextPage = overrides.page ?? String(page)

        if (nextYear) params.set('year', nextYear)
        if (nextDepartmentId && nextDepartmentId !== 'all') params.set('departmentId', nextDepartmentId)
        if (nextPapId && nextPapId !== 'all') params.set('papId', nextPapId)
        if (nextExpenseClass && nextExpenseClass !== 'all') params.set('expenseClass', nextExpenseClass)
        if (nextSearch.trim()) params.set('search', nextSearch.trim())
        if (nextIncludeDbmRejectedLineItems === 'true') params.set('includeDbmRejectedLineItems', 'true')
        if (nextPage !== '1') params.set('page', nextPage)

        return `/dbm/allocations?${params.toString()}`
    }

    const updateRowState = (allocation: AllocationDashboardRow) => {
        setRowsState((current) => current.map((row) => (row.id === allocation.id ? { ...row, ...allocation } : row)))

        setInputValues((current) => {
            const next = { ...current }
            delete next[getInputKey(allocation.id, 'dbm_rec_amt')]
            delete next[getInputKey(allocation.id, 'nep_amt')]
            delete next[getInputKey(allocation.id, 'gaa_amt')]
            delete next[getInputKey(allocation.id, 'valid_from')]
            delete next[getInputKey(allocation.id, 'valid_until')]
            return next
        })
    }

    const handleSave = (
        allocationId: string,
        field: 'dbm_rec_amt' | 'nep_amt' | 'gaa_amt' | 'valid_from' | 'valid_until' | 'release_classification',
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
                            : { action, field, value: rawValue }
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
            } catch (error) {
                setSaveStates((current) => ({ ...current, [saveKey]: 'error' }))
                const message = error instanceof Error ? error.message : 'Allocation update failed.'
                setFloatingStatus({
                    type: 'error',
                    message: action === 'remove_line_item'
                        ? `Failed to remove line item: ${message}`
                        : `Failed to save allocation change: ${message}`,
                })
                return
            }

            if (action === 'remove_line_item') {
                setFloatingStatus({
                    type: 'success',
                    message: 'Line item marked as removed in GAA.',
                })
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
                    expense_class: ['expense_class', 'expense_class_and_tier'].includes(bulkValidity.scope)
                        ? bulkValidity.expense_class
                        : '',
                    tier: ['tier', 'expense_class_and_tier'].includes(bulkValidity.scope)
                        ? bulkValidity.tier
                        : '',
                    valid_from: bulkValidity.valid_from,
                    valid_until: bulkValidity.valid_until,
                }),
            })

            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error || 'Bulk validity update failed.')
            }

            setBulkValidityStatus(`Updated ${result.updatedCount} allocation validity records.`)
            setFloatingStatus({
                type: 'success',
                message: `Updated ${result.updatedCount} allocation validity record${result.updatedCount === 1 ? '' : 's'}.`,
            })
            router.refresh()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Bulk validity update failed.'
            setBulkValidityError(message)
            setFloatingStatus({
                type: 'error',
                message: `Bulk validity update failed: ${message}`,
            })
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
            setFloatingStatus({
                type: 'success',
                message: 'Legislative insertion line item created.',
            })
            router.refresh()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create legislative insertion.'
            setInsertionError(message)
            setFloatingStatus({
                type: 'error',
                message: `Legislative insertion failed: ${message}`,
            })
        } finally {
            setInsertionLoading(false)
        }
    }

    return (
        <main className="mx-auto max-w-[1900px] space-y-5 px-4 py-8 pb-24">
            <FloatingStatus
                status={floatingStatus}
                onClear={() => setFloatingStatus(null)}
            />
            <div className="flex items-center justify-between">
                <BackButton url="/dbm" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground my-2">Budget Allocations</h1>
                    <p className="text-sm font-medium text-muted-foreground">
                        Review DBM recommendations, NEP adjustments, and GAA revisions in one place.
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <StickySummaryHeader
                activeCycle={activeCycle}
                viewingYear={viewingYear}
                totals={displayedOverallTotals}
                showGaaTotals={showGaaTotals}
            />

            {viewingYear && integrityTargets.length > 0 ? (
                <section className="rounded-2xl border border-border bg-background px-5 py-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-base font-semibold text-secondary-foreground">Integrity Checks</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Verify the signed NEP and GAA checkpoints for Fiscal Year {viewingYear} at any time from the dashboard.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {integrityTargets.map((target) => (
                                <VerifyAllocationSignoffIntegrityDialog
                                    key={`${viewingYear}-${target}`}
                                    fiscalYear={viewingYear}
                                    signoffType={target}
                                    buttonLabel={target === 'nep' ? 'Verify NEP Integrity' : 'Verify GAA Integrity'}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            ) : null}

            <AllocationSignoffPanel
                key={`${signoff?.formId ?? 'none'}-${currentPhase ?? 'none'}`}
                signoff={signoff}
                currentPhase={currentPhase}
                signingBlocked={currentPhase === 'legislative_deliberation' && gaaExceedsNep}
                signingBlockedMessage={
                    currentPhase === 'legislative_deliberation' && gaaExceedsNep
                        ? 'GAA sign-off is blocked while the GAA total exceeds the NEP total.'
                        : undefined
                }
                onApproved={() => {
                    setFloatingStatus({
                        type: 'success',
                        message: `${currentPhase === 'presidential_approval' ? 'NEP' : 'GAA'} signoff completed.`,
                    })
                    router.refresh()
                }}
                onSignError={(message) => {
                    setFloatingStatus({
                        type: 'error',
                        message: `${currentPhase === 'presidential_approval' ? 'NEP' : 'GAA'} signoff failed: ${message}`,
                    })
                }}
            />

            <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-background p-2 shadow-sm">
                <Button
                    type="button"
                    variant={activeView === 'line_items' ? 'default' : 'outline'}
                    onClick={() => setActiveView('line_items')}
                    className={activeView === 'line_items' ? 'bg-secondary-foreground text-background hover:bg-secondary-foreground/90' : ''}
                >
                    Line Items
                </Button>
                <Button
                    type="button"
                    variant={activeView === 'summary' ? 'default' : 'outline'}
                    onClick={() => setActiveView('summary')}
                    className={activeView === 'summary' ? 'bg-secondary-foreground text-background hover:bg-secondary-foreground/90' : ''}
                >
                    Department Summary
                </Button>
            </div>

            {activeView === 'summary' ? (
                <AllocationBudgetSummary
                    currentPhase={currentPhase}
                    departments={departments}
                    summaries={hierarchySummaries}
                    overallTotals={overallTotals}
                />
            ) : null}

            {activeView === 'line_items' && canEditGaa ? (
                <BulkValidityPanel
                    open={bulkValidityOpen}
                    onToggle={() => setBulkValidityOpen((open) => !open)}
                    value={bulkValidity}
                    onChange={setBulkValidity}
                    loading={bulkValidityLoading}
                    status={bulkValidityStatus}
                    error={bulkValidityError}
                    onApply={handleBulkValidityUpdate}
                />
            ) : null}

            {activeView === 'line_items' ? (
                <>
                    <AllocationFiltersPanel
                        open={filtersOpen}
                        onToggle={() => setFiltersOpen((open) => !open)}
                        availableYears={availableYears}
                        yearLockedToActivePreparation={yearLockedToActivePreparation}
                        selectedYear={selectedYear}
                        onSelectedYearChange={setSelectedYear}
                        departments={departments}
                        departmentId={departmentId}
                        onDepartmentIdChange={setDepartmentId}
                        paps={paps}
                        papId={papId}
                        onPapIdChange={setPapId}
                        expenseClass={expenseClass}
                        onExpenseClassChange={setExpenseClass}
                        searchValue={searchValue}
                        onSearchValueChange={setSearchValue}
                        showUacs={showUacs}
                        onShowUacsChange={setShowUacs}
                showDbmRejectedLineItems={showDbmRejectedLineItems}
                onShowDbmRejectedLineItemsChange={(checked) => {
                    setShowDbmRejectedLineItems(checked)
                    router.push(getFilterLink({
                        includeDbmRejectedLineItems: checked ? 'true' : 'false',
                        page: '1',
                    }))
                }}
                onSubmit={() => router.push(getFilterLink({ page: '1' }))}
                        clearHref={`/dbm/allocations${yearLockedToActivePreparation && selectedYear ? `?year=${selectedYear}` : ''}`}
                    />

                    <AllocationTable
                        rowsState={rowsState}
                        inputValues={inputValues}
                        saveStates={saveStates}
                        currentPhase={currentPhase}
                        showUacs={showUacs}
                        columnCount={columnCount}
                        page={page}
                        totalPages={totalPages}
                        isFiltered={isFiltered}
                        filteredTotals={filteredTotals}
                        displayedFilteredTotals={displayedFilteredTotals}
                        onInputChange={(allocationId, field, value) =>
                            setInputValues((current) => ({
                                ...current,
                                [getInputKey(allocationId, field)]: value,
                            }))
                        }
                        onSave={handleSave}
                        getFilterLink={getFilterLink}
                        onOpenHistory={setHistoryRow}
                    />
                </>
            ) : null}

            {activeView === 'line_items' && canEditGaa ? (
                <div className="pointer-events-none fixed bottom-6 right-6 z-30 flex justify-end">
                    <Button
                        type="button"
                        size="lg"
                        onClick={() => setLegislativeInsertOpen(true)}
                        className="pointer-events-auto rounded-full bg-emerald-700 px-5 text-white shadow-lg hover:bg-emerald-700/90"
                    >
                        <CirclePlus className="h-4 w-4" />
                        Insert Line Item
                    </Button>
                </div>
            ) : null}

            <LegislativeInsertionDialog
                open={legislativeInsertOpen}
                onClose={() => setLegislativeInsertOpen(false)}
                value={insertionState}
                onChange={setInsertionState}
                paps={paps}
                entities={orderedEntities}
                items={items}
                fundingSources={fundingSources}
                loading={insertionLoading}
                error={insertionError}
                onSubmit={handleLegislativeInsertion}
            />

            <AllocationHistoryDrawer
                key={historyRow?.id ?? 'closed'}
                row={historyRow}
                open={!!historyRow}
                onClose={() => setHistoryRow(null)}
            />
        </main>
    )
}
