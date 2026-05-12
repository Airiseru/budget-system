'use client'

import Link from 'next/link'
import { Fragment } from 'react'
import {
    ArrowDownRight,
    ArrowUpRight,
    Check,
    MessageSquareText,
    CircleMinus,
    CirclePlus,
} from 'lucide-react'
import type { BudgetCyclePhase } from '@/src/types/budget_settings'
import type {
    AllocationDashboardRow,
    AllocationDashboardTotals,
} from '@/src/db/postgres/repositories/budgetAllocationRepository'
import type { SaveState } from './shared'
import {
    formatAmount,
    generatePageNumbers,
    getAllocationGroupKey,
    getChangeTone,
    getInputKey,
    getNumericInputValue,
} from './shared'
import { formatDateOnlyForInput } from '@/src/lib/dateOnly'

type Props = {
    rowsState: AllocationDashboardRow[]
    inputValues: Record<string, string>
    saveStates: Record<string, SaveState>
    currentPhase: BudgetCyclePhase | null
    showUacs: boolean
    columnCount: number
    page: number
    totalPages: number
    isFiltered: boolean
    filteredTotals: AllocationDashboardTotals
    displayedFilteredTotals: AllocationDashboardTotals
    onInputChange: (allocationId: string, field: string, value: string) => void
    onSave: (
        allocationId: string,
        field: 'dbm_rec_amt' | 'nep_amt' | 'gaa_amt' | 'valid_from' | 'valid_until',
        rawValue: string,
        action?: 'update_field' | 'remove_line_item'
    ) => void
    getFilterLink: (overrides?: { page?: string }) => string
    onOpenHistory: (row: AllocationDashboardRow) => void
}

export default function AllocationTable({
    rowsState,
    inputValues,
    saveStates,
    currentPhase,
    showUacs,
    columnCount,
    page,
    totalPages,
    isFiltered,
    filteredTotals,
    displayedFilteredTotals,
    onInputChange,
    onSave,
    getFilterLink,
    onOpenHistory,
}: Props) {
    const canEditDbmReview = currentPhase === 'dbm_review'
    const canEditNep = currentPhase === 'presidential_approval'
    const canEditGaa = currentPhase === 'legislative_deliberation'
    const showStaticTotals = !currentPhase || currentPhase === 'preparation' || currentPhase === 'enacted_gaa'

    const groupedRows = rowsState.reduce<Record<string, AllocationDashboardRow[]>>((acc, row) => {
        const key = getAllocationGroupKey(row)
        if (!acc[key]) acc[key] = []
        acc[key].push(row)
        return acc
    }, {})

    return (
        <section className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm">
            <div className="max-h-[70vh] overflow-auto">
                <table className="w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-primary-foreground text-sm uppercase text-white shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
                        <tr>
                            <th className="px-4 py-3">Department</th>
                            <th className="px-4 py-3">Agency</th>
                            <th className="px-4 py-3">Operating Unit</th>
                            <th className="px-4 py-3">Fund Source</th>
                            <th className="px-4 py-3">Expense Class</th>
                            <th className="px-4 py-3">Line Item</th>
                            {canEditDbmReview ? (
                                <>
                                    <th className="px-4 py-3 text-right">Proposed</th>
                                    <th className="px-4 py-3 text-right">DBM Rec</th>
                                </>
                            ) : null}
                            {canEditNep ? (
                                <>
                                    <th className="px-4 py-3 text-right">DBM Rec</th>
                                    <th className="px-4 py-3 text-right">NEP</th>
                                </>
                            ) : null}
                            {canEditGaa ? (
                                <>
                                    <th className="px-4 py-3 text-right">NEP</th>
                                    <th className="px-4 py-3 text-right">GAA</th>
                                    <th className="px-4 py-3">Validity</th>
                                </>
                            ) : null}
                            {showStaticTotals ? (
                                <>
                                    <th className="px-4 py-3 text-right">Proposed</th>
                                    <th className="px-4 py-3 text-right">DBM Rec</th>
                                    <th className="px-4 py-3 text-right">NEP</th>
                                    <th className="px-4 py-3 text-right">GAA</th>
                                </>
                            ) : null}
                            <th className="px-4 py-3 text-right">Prev Year Diff</th>
                            <th className="px-4 py-3 text-right">History</th>
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
                            const currentGroupKey = getAllocationGroupKey(row)
                            const previousGroupKey = previousRow ? getAllocationGroupKey(previousRow) : null
                            const nextGroupKey = nextRow ? getAllocationGroupKey(nextRow) : null
                            const shouldShowDivider = currentGroupKey !== previousGroupKey
                            const shouldShowSubtotal = currentGroupKey !== nextGroupKey
                            const activeAmount =
                                canEditNep
                                    ? Number(row.nep_amt)
                                    : canEditGaa
                                        ? Number(row.gaa_amt)
                                        : Number(row.gaa_amt)
                            const isViewOnlyPhase = !currentPhase || currentPhase === 'enacted_gaa'
                            const prevYearAmount = Number(row.prev_year_gaa_amt ?? 0)
                            const prevYearDiffAmount = activeAmount - prevYearAmount
                            const hasNoPrevYearDiff = Math.abs(prevYearDiffAmount) === 0
                            const nepAmount = Number(row.nep_amt)
                            const gaaAmount = Number(row.gaa_amt)
                            const currentGaaAmount = getNumericInputValue(inputValues, row, 'gaa_amt')
                            const nepVsGaaDiff =
                                nepAmount === 0
                                    ? (gaaAmount === 0 ? 0 : 100)
                                    : ((gaaAmount - nepAmount) / nepAmount) * 100
                            const hasNoNepToGaaChange = Math.abs(nepVsGaaDiff) < 0.0001
                            const removedInGaa =
                                canEditGaa &&
                                Number(row.gaa_amt) === 0 &&
                                Number(row.nep_amt) > 0
                            const legislativeInsertion =
                                row.origin_tag === 'legislative_insertion' ||
                                (Number(row.nep_amt) === 0 && Number(row.gaa_amt) > 0)
                            const rejectedByDbm =
                                Number(row.proposed_amt) > 0 &&
                                Number(row.dbm_rec_amt) === 0
                            const vetoedByPresident =
                                (canEditNep || canEditGaa || isViewOnlyPhase) &&
                                Number(row.dbm_rec_amt) > 0 &&
                                Number(row.nep_amt) === 0
                            const groupRows = groupedRows[currentGroupKey] ?? []
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
                                    {shouldShowDivider ? (
                                        <tr className="bg-primary-foreground/80">
                                            <td colSpan={columnCount} className="px-4 py-3">
                                                <div className="font-semibold text-white">
                                                    {(row.pap_project_type ?? 'Unclassified Project').toUpperCase()} • {row.pap_title ?? 'No PAP'}
                                                </div>
                                                {showUacs && row.pap_uacs_code ? (
                                                    <div className="mt-1 text-xs text-white/70">
                                                        PREXC FPAP ID: {row.pap_uacs_code}
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ) : null}

                                    <tr className={removedInGaa ? 'bg-red-50/40' : ''}>
                                        <td className="px-4 py-3 align-middle">
                                            <div>{row.department_name ?? '00'}</div>
                                            {showUacs ? <div className="text-xs text-muted-foreground">{row.department_uacs_code ?? '00'}</div> : null}
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <div>{row.agency_name ?? '000'}</div>
                                            {showUacs ? <div className="text-xs text-muted-foreground">{row.agency_uacs_code ?? '000'}</div> : null}
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <div>{row.operating_unit_name ?? '0000000'}</div>
                                            {showUacs ? <div className="text-xs text-muted-foreground">{row.operating_unit_uacs_code ?? '0000000'}</div> : null}
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <div>{row.fund_description ?? row.fund_code ?? 'No fund source'}</div>
                                            {showUacs ? <div className="text-xs text-muted-foreground">{row.fund_code ?? '—'}</div> : null}
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <div>{row.expense_class}</div>
                                            {showUacs ? <div className="text-xs text-muted-foreground">{row.expense_class_code}</div> : null}
                                        </td>
                                        <td className="px-4 py-3 align-middle">
                                            <div className="space-y-1">
                                                <div>{row.item_name}</div>
                                                {showUacs ? <div className="text-xs text-muted-foreground">{row.object_code}</div> : null}
                                                <div className="flex flex-wrap gap-2">
                                                    {legislativeInsertion ? (
                                                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">
                                                            <CirclePlus className="h-5 w-5" />
                                                            Legislative insertion
                                                        </span>
                                                    ) : null}
                                                    {rejectedByDbm ? (
                                                        <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-800">
                                                            <CircleMinus className="h-4 w-4" />
                                                            Rejected by DBM
                                                        </span>
                                                    ) : null}
                                                    {vetoedByPresident ? (
                                                        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
                                                            <CircleMinus className="h-4 w-4" />
                                                            Vetoed by President
                                                        </span>
                                                    ) : null}
                                                    {removedInGaa ? (
                                                        <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">
                                                            <CircleMinus className="h-4 w-4" />
                                                            Removed in GAA
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>

                                        {canEditDbmReview ? (
                                            <>
                                                <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.proposed_amt))}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={inputValues[getInputKey(row.id, 'dbm_rec_amt')] ?? String(row.dbm_rec_amt)}
                                                        onChange={(event) => onInputChange(row.id, 'dbm_rec_amt', event.target.value)}
                                                        onBlur={(event) => onSave(row.id, 'dbm_rec_amt', event.target.value)}
                                                        className="w-[160px] rounded-md border border-border bg-background px-3 py-2 text-right font-mono"
                                                    />
                                                    {saveStates[getInputKey(row.id, 'dbm_rec_amt')] === 'saved' ? (
                                                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                                                            <Check className="h-3 w-3" /> Saved
                                                        </span>
                                                    ) : null}
                                                </td>
                                            </>
                                        ) : null}

                                        {canEditNep ? (
                                            <>
                                                <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.dbm_rec_amt))}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={inputValues[getInputKey(row.id, 'nep_amt')] ?? String(row.nep_amt)}
                                                        onChange={(event) => onInputChange(row.id, 'nep_amt', event.target.value)}
                                                        onBlur={(event) => onSave(row.id, 'nep_amt', event.target.value)}
                                                        className="w-[160px] rounded-md border border-border bg-background px-3 py-2 text-right font-mono"
                                                    />
                                                    {saveStates[getInputKey(row.id, 'nep_amt')] === 'saved' ? (
                                                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                                                            <Check className="h-3 w-3" /> Saved
                                                        </span>
                                                    ) : null}
                                                </td>
                                            </>
                                        ) : null}

                                        {canEditGaa ? (
                                            <>
                                                <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.nep_amt))}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={inputValues[getInputKey(row.id, 'gaa_amt')] ?? String(row.gaa_amt)}
                                                            onChange={(event) => onInputChange(row.id, 'gaa_amt', event.target.value)}
                                                            onBlur={(event) => onSave(row.id, 'gaa_amt', event.target.value)}
                                                            className="w-[160px] rounded-md border border-border bg-background px-3 py-2 text-right font-mono"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => onSave(row.id, 'gaa_amt', '0', 'remove_line_item')}
                                                            className="rounded-md border border-red-300 px-2 py-2 text-red-700 hover:bg-red-50 disabled:bg-red-50 disabled:text-red-700/50 disabled:border-red-300/50 disabled:cursor-not-allowed"
                                                            disabled={(
                                                                saveStates[getInputKey(row.id, 'gaa_amt')] === 'saving' ||
                                                                saveStates[getInputKey(row.id, 'gaa_amt')] === 'saved' ||
                                                                currentGaaAmount === 0
                                                            )}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                    <div className="mt-1 flex items-center justify-end gap-2">
                                                        {saveStates[getInputKey(row.id, 'gaa_amt')] === 'saved' ? (
                                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                                                <Check className="h-3 w-3" /> Saved
                                                            </span>
                                                        ) : null}
                                                        {!hasNoNepToGaaChange && (
                                                            <span className={`inline-flex items-center gap-1 text-xs ${nepVsGaaDiff >= 0 ? 'text-emerald-700' : 'text-red-700'} ${getChangeTone(nepVsGaaDiff)}`}>
                                                                {nepVsGaaDiff >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                                                {Math.abs(nepVsGaaDiff).toFixed(1)}% vs NEP
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-middle">
                                                    <div className="flex gap-2 flex-col">
                                                        <div className="flex flex-col gap-1">
                                                            <label htmlFor="valid_from" className="">From</label>
                                                            <input
                                                                id="valid_from"
                                                                type="date"
                                                                value={inputValues[getInputKey(row.id, 'valid_from')] ?? (row.valid_from ? formatDateOnlyForInput(row.valid_from) : '')}
                                                                onChange={(event) => onInputChange(row.id, 'valid_from', event.target.value)}
                                                                onBlur={(event) => onSave(row.id, 'valid_from', event.target.value)}
                                                                className="rounded-md border border-border bg-background px-2 py-2 text-xs"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label htmlFor="valid_until">Until</label>
                                                            <input
                                                                id="valid_until"
                                                                type="date"
                                                                value={inputValues[getInputKey(row.id, 'valid_until')] ?? (row.valid_until ? formatDateOnlyForInput(row.valid_until) : '')}
                                                                onChange={(event) => onInputChange(row.id, 'valid_until', event.target.value)}
                                                                onBlur={(event) => onSave(row.id, 'valid_until', event.target.value)}
                                                                className="rounded-md border border-border bg-background px-2 py-2 text-xs"
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </>
                                        ) : null}

                                        {showStaticTotals ? (
                                            <>
                                                <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.proposed_amt))}</td>
                                                <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.dbm_rec_amt))}</td>
                                                <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.nep_amt))}</td>
                                                <td className="px-4 py-3 text-right font-mono">PHP {formatAmount(Number(row.gaa_amt))}</td>
                                            </>
                                        ) : null}

                                        <td className="px-4 py-3 text-right">
                                            {hasNoPrevYearDiff ? (
                                                <span className="text-muted-foreground">-</span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1 ${prevYearDiffAmount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {prevYearDiffAmount >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                                    PHP {formatAmount(Math.abs(prevYearDiffAmount))}
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => onOpenHistory(row)}
                                                className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-secondary-foreground"
                                                aria-label={`View history for ${row.item_name}`}
                                            >
                                                <MessageSquareText className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>

                                    {shouldShowSubtotal ? (
                                        <tr className="border-y border-border/30 bg-muted/30">
                                            <td colSpan={6} className="px-4 py-3 text-right font-semibold text-secondary-foreground">
                                                PAP subtotal
                                            </td>
                                            {canEditDbmReview ? (
                                                <>
                                                    <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                        PHP {formatAmount(groupSubtotal.proposed_total)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                        PHP {formatAmount(groupSubtotal.dbm_rec_total)}
                                                    </td>
                                                </>
                                            ) : null}
                                            {canEditNep ? (
                                                <>
                                                    <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                        PHP {formatAmount(groupSubtotal.dbm_rec_total)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                        PHP {formatAmount(groupSubtotal.nep_total)}
                                                    </td>
                                                </>
                                            ) : null}
                                            {canEditGaa ? (
                                                <>
                                                    <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                        PHP {formatAmount(groupSubtotal.nep_total)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                        PHP {formatAmount(groupSubtotal.gaa_total)}
                                                    </td>
                                                    <td className="px-4 py-3" />
                                                </>
                                            ) : null}
                                            {showStaticTotals ? (
                                                <>
                                                    <td className="px-4 py-3 text-right font-mono text-secondary-foreground">
                                                        PHP {formatAmount(groupSubtotal.proposed_total)}
                                                    </td>
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
                                            ) : null}
                                            <td className="px-4 py-3" />
                                            <td className="px-4 py-3" />
                                        </tr>
                                    ) : null}
                                </Fragment>
                            )
                        })}
                    </tbody>

                    {isFiltered ? (
                        <tfoot className="border-t border-border/40 bg-muted/40">
                            <tr>
                                <td colSpan={6} className="px-4 py-3 text-right font-semibold text-secondary-foreground">
                                    Filtered subtotal
                                </td>
                                {canEditDbmReview ? (
                                    <>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                            PHP {formatAmount(filteredTotals.proposed_total)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                            PHP {formatAmount(displayedFilteredTotals.dbm_rec_total)}
                                        </td>
                                    </>
                                ) : null}
                                {canEditNep ? (
                                    <>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                            PHP {formatAmount(displayedFilteredTotals.dbm_rec_total)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                            PHP {formatAmount(displayedFilteredTotals.nep_total)}
                                        </td>
                                    </>
                                ) : null}
                                {canEditGaa ? (
                                    <>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                            PHP {formatAmount(displayedFilteredTotals.nep_total)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                            PHP {formatAmount(displayedFilteredTotals.gaa_total)}
                                        </td>
                                        <td className="px-4 py-3" />
                                    </>
                                ) : null}
                                {showStaticTotals ? (
                                    <>
                                        <td className="px-4 py-3 text-right font-mono font-semibold text-secondary-foreground">
                                            PHP {formatAmount(filteredTotals.proposed_total)}
                                        </td>
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
                                ) : null}
                                <td className="px-4 py-3" />
                                <td className="px-4 py-3" />
                            </tr>
                        </tfoot>
                    ) : null}
                </table>
            </div>

            <div className="flex items-center justify-between border-t border-border/30 bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                    Showing page <span className="font-bold">{page}</span> of <span className="font-bold">{totalPages !== 0 ? totalPages : 1}</span>
                </p>
                <div className="flex items-center gap-1">
                    <Link
                        href={page > 1 ? getFilterLink({ page: String(page - 1) }) : '#'}
                        className={`rounded px-2.5 py-1.5 text-sm font-bold transition-colors ${page > 1 ? 'bg-accent text-secondary-foreground hover:bg-secondary' : 'pointer-events-none bg-accent/50 text-muted-foreground/40'}`}
                        aria-disabled={page <= 1}
                    >
                        &lt;
                    </Link>
                    {generatePageNumbers(page, totalPages).map((current, index) =>
                        current === '...' ? (
                            <span key={`ellipsis-${index}`} className="px-2 py-1.5 text-sm font-bold text-muted-foreground">
                                ...
                            </span>
                        ) : (
                            <Link
                                key={`page-${current}`}
                                href={getFilterLink({ page: String(current) })}
                                className={`rounded border-b px-3 py-1.5 text-sm font-bold transition-colors ${
                                    page === current
                                        ? 'border-secondary-foreground bg-secondary-foreground text-accent'
                                        : 'border-border/50 bg-accent text-secondary-foreground hover:bg-secondary'
                                }`}
                            >
                                {current}
                            </Link>
                        )
                    )}
                    <Link
                        href={page < totalPages ? getFilterLink({ page: String(page + 1) }) : '#'}
                        className={`rounded px-2.5 py-1.5 text-sm font-bold transition-colors ${page < totalPages ? 'bg-accent text-secondary-foreground hover:bg-secondary' : 'pointer-events-none bg-accent/50 text-muted-foreground/40'}`}
                        aria-disabled={page >= totalPages}
                    >
                        &gt;
                    </Link>
                </div>
            </div>
        </section>
    )
}
