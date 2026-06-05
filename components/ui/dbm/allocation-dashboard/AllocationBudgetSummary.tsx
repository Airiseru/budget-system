'use client'

import { useMemo, useState } from 'react'
import type { BudgetCyclePhase } from '@/src/types/budget_settings'
import type { Department } from '@/src/types/entities'
import type {
    AllocationDashboardTotals,
    AllocationHierarchySummaryRow,
} from '@/src/db/postgres/repositories/budgetAllocationRepository'
import SearchableComboboxField, { type SearchableComboboxOption } from '@/components/ui/dbm/SearchableComboboxField'

type Props = {
    currentPhase: BudgetCyclePhase | null
    departments: Department[]
    summaries: AllocationHierarchySummaryRow[]
    overallTotals: AllocationDashboardTotals
}

type SummaryTotals = AllocationDashboardTotals

const EXPENSE_CLASSES = ['PS', 'MOOE', 'CO', 'FINEX'] as const

function getActiveTotalKey(currentPhase: BudgetCyclePhase | null): keyof AllocationDashboardTotals {
    if (currentPhase === 'preparation' || currentPhase === 'dbm_review') return 'dbm_rec_total'
    if (currentPhase === 'presidential_approval') return 'nep_total'
    return 'gaa_total'
}

function formatAmount(amount: number) {
    return Number(amount ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

function makeEmptyTotals(): SummaryTotals {
    return {
        proposed_total: 0,
        dbm_rec_total: 0,
        nep_total: 0,
        gaa_total: 0,
    }
}

function addTotals(target: SummaryTotals, row: AllocationHierarchySummaryRow) {
    target.proposed_total += Number(row.proposed_total ?? 0)
    target.dbm_rec_total += Number(row.dbm_rec_total ?? 0)
    target.nep_total += Number(row.nep_total ?? 0)
    target.gaa_total += Number(row.gaa_total ?? 0)
}

function getPercent(value: number, overall: number) {
    if (!overall) return '0.00%'
    return `${((value / overall) * 100).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}%`
}

export default function AllocationBudgetSummary({
    currentPhase,
    departments,
    summaries,
    overallTotals,
}: Props) {
    const [selectedDepartmentId, setSelectedDepartmentId] = useState('all')
    const activeTotalKey = getActiveTotalKey(currentPhase)
    const overallActiveTotal = Number(overallTotals[activeTotalKey] ?? 0)

    const departmentOptions: SearchableComboboxOption[] = useMemo(() => [
        { value: 'all', label: 'All departments' },
        ...departments
            .slice()
            .sort((a, b) => String(a.uacs_code ?? '').localeCompare(String(b.uacs_code ?? '')))
            .map((department) => ({
                value: department.id,
                label: `${department.uacs_code ?? '00'} - ${department.name}`,
                searchText: `${department.name} ${department.abbr ?? ''} ${department.uacs_code ?? ''}`,
            })),
    ], [departments])

    const departmentSummaries = useMemo(() => {
        const byDepartment = new Map<string, {
            id: string
            name: string
            uacsCode: string
            totals: SummaryTotals
            expenseTotals: Record<string, number>
        }>()

        summaries.forEach((row) => {
            const id = row.department_id ?? 'unassigned'
            const summary = byDepartment.get(id) ?? {
                id,
                name: row.department_name ?? 'Unassigned Department',
                uacsCode: row.department_uacs_code ?? '00',
                totals: makeEmptyTotals(),
                expenseTotals: Object.fromEntries(EXPENSE_CLASSES.map((expenseClass) => [expenseClass, 0])),
            }

            addTotals(summary.totals, row)
            summary.expenseTotals[row.expense_class] = (summary.expenseTotals[row.expense_class] ?? 0) + Number(row[activeTotalKey] ?? 0)
            byDepartment.set(id, summary)
        })

        return Array.from(byDepartment.values()).sort((a, b) => a.uacsCode.localeCompare(b.uacsCode))
    }, [activeTotalKey, summaries])

    const selectedDepartment = selectedDepartmentId === 'all'
        ? null
        : departmentSummaries.find((department) => department.id === selectedDepartmentId) ?? null

    const agencyBreakdown = useMemo(() => {
        if (!selectedDepartment) return []

        const rows = summaries.filter((row) => (row.department_id ?? 'unassigned') === selectedDepartment.id)
        const byAgency = new Map<string, {
            id: string
            name: string
            uacsCode: string
            totals: SummaryTotals
            expenseTotals: Record<string, number>
            operatingUnits: Map<string, {
                id: string
                name: string
                uacsCode: string
                totals: SummaryTotals
                expenseTotals: Record<string, number>
            }>
        }>()

        rows.forEach((row) => {
            const agencyId = row.agency_id ?? `${selectedDepartment.id}:direct`
            const agency = byAgency.get(agencyId) ?? {
                id: agencyId,
                name: row.agency_name ?? `${selectedDepartment.name} Direct Allocations`,
                uacsCode: row.agency_uacs_code ?? '000',
                totals: makeEmptyTotals(),
                expenseTotals: Object.fromEntries(EXPENSE_CLASSES.map((expenseClass) => [expenseClass, 0])),
                operatingUnits: new Map(),
            }

            addTotals(agency.totals, row)
            agency.expenseTotals[row.expense_class] = (agency.expenseTotals[row.expense_class] ?? 0) + Number(row[activeTotalKey] ?? 0)

            const operatingUnitId = row.operating_unit_id ?? `${agencyId}:direct`
            const operatingUnit = agency.operatingUnits.get(operatingUnitId) ?? {
                id: operatingUnitId,
                name: row.operating_unit_name ?? 'Agency-level Allocations',
                uacsCode: row.operating_unit_uacs_code ?? '0000000',
                totals: makeEmptyTotals(),
                expenseTotals: Object.fromEntries(EXPENSE_CLASSES.map((expenseClass) => [expenseClass, 0])),
            }

            addTotals(operatingUnit.totals, row)
            operatingUnit.expenseTotals[row.expense_class] = (operatingUnit.expenseTotals[row.expense_class] ?? 0) + Number(row[activeTotalKey] ?? 0)
            agency.operatingUnits.set(operatingUnitId, operatingUnit)
            byAgency.set(agencyId, agency)
        })

        return Array.from(byAgency.values())
            .sort((a, b) => a.uacsCode.localeCompare(b.uacsCode))
            .map((agency) => ({
                ...agency,
                operatingUnits: Array.from(agency.operatingUnits.values()).sort((a, b) => a.uacsCode.localeCompare(b.uacsCode)),
            }))
    }, [activeTotalKey, selectedDepartment, summaries])

    const activeLabel = activeTotalKey === 'dbm_rec_total'
        ? 'DBM Recommended'
        : activeTotalKey === 'nep_total'
            ? 'NEP'
            : 'GAA'

    return (
        <section className="space-y-4 rounded-2xl border border-border bg-background p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Budget Summary</p>
                    <h2 className="mt-1 text-2xl font-black text-secondary-foreground">Department Allocation Summary</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Showing {activeLabel} totals, share of the overall budget, and totals per expense class.
                    </p>
                </div>
                <div className="w-full max-w-md">
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Department drilldown
                    </label>
                    <SearchableComboboxField
                        items={departmentOptions}
                        value={selectedDepartmentId}
                        placeholder="All departments"
                        searchPlaceholder="Search departments"
                        emptyText="No departments found."
                        onValueChange={setSelectedDepartmentId}
                    />
                </div>
            </div>

            {!selectedDepartment ? (
                <div className="overflow-hidden rounded-xl border border-border/50">
                    <table className="w-full min-w-[920px] text-left text-sm">
                        <thead className="bg-secondary/20 text-xs font-black uppercase tracking-wider text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3">Department</th>
                                <th className="px-4 py-3 text-right">Total</th>
                                <th className="px-4 py-3 text-right">% Overall</th>
                                {EXPENSE_CLASSES.map((expenseClass) => (
                                    <th key={expenseClass} className="px-4 py-3 text-right">{expenseClass}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {departmentSummaries.map((department) => {
                                const total = Number(department.totals[activeTotalKey] ?? 0)
                                return (
                                    <tr key={department.id} className="hover:bg-secondary/10">
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDepartmentId(department.id)}
                                                className="text-left font-bold text-secondary-foreground hover:underline"
                                            >
                                                {department.name}
                                            </button>
                                            <div className="text-xs text-muted-foreground">{department.uacsCode}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold tabular-nums">{formatAmount(total)}</td>
                                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{getPercent(total, overallActiveTotal)}</td>
                                        {EXPENSE_CLASSES.map((expenseClass) => (
                                            <td key={expenseClass} className="px-4 py-3 text-right tabular-nums">
                                                {formatAmount(department.expenseTotals[expenseClass] ?? 0)}
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-4 py-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="font-black text-primary-foreground">{selectedDepartment.name}</h3>
                                <p className="text-sm text-primary-foreground/80">
                                    Total {activeLabel}: {formatAmount(Number(selectedDepartment.totals[activeTotalKey] ?? 0))} • {getPercent(Number(selectedDepartment.totals[activeTotalKey] ?? 0), overallActiveTotal)} of overall
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDepartmentId('all')}
                                className="text-sm font-bold text-primary-foreground underline underline-offset-4"
                            >
                                View all departments
                            </button>
                        </div>
                    </div>

                    {agencyBreakdown.map((agency) => {
                        const agencyTotal = Number(agency.totals[activeTotalKey] ?? 0)
                        return (
                            <article key={agency.id} className="overflow-hidden rounded-xl border border-border/50">
                                <div className="border-b border-border/40 bg-secondary/20 px-4 py-3">
                                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h4 className="font-black text-secondary-foreground">{agency.name}</h4>
                                            <p className="text-xs text-muted-foreground">{agency.uacsCode}</p>
                                        </div>
                                        <div className="text-sm font-bold tabular-nums text-secondary-foreground">
                                            {formatAmount(agencyTotal)} ({getPercent(agencyTotal, overallActiveTotal)})
                                        </div>
                                    </div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                        {EXPENSE_CLASSES.map((expenseClass) => (
                                            <div key={expenseClass} className="rounded-lg border border-border/40 bg-background px-3 py-2">
                                                <div className="text-xs font-bold text-muted-foreground">{expenseClass}</div>
                                                <div className="text-sm font-black tabular-nums">{formatAmount(agency.expenseTotals[expenseClass] ?? 0)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] text-left text-sm">
                                        <thead className="bg-muted/30 text-xs font-black uppercase tracking-wider text-muted-foreground">
                                            <tr>
                                                <th className="px-4 py-3">Operating Unit</th>
                                                <th className="px-4 py-3 text-right">Total</th>
                                                {EXPENSE_CLASSES.map((expenseClass) => (
                                                    <th key={expenseClass} className="px-4 py-3 text-right">{expenseClass}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {agency.operatingUnits.map((operatingUnit) => (
                                                <tr key={operatingUnit.id}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-secondary-foreground">{operatingUnit.name}</div>
                                                        <div className="text-xs text-muted-foreground">{operatingUnit.uacsCode}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                                                        {formatAmount(Number(operatingUnit.totals[activeTotalKey] ?? 0))}
                                                    </td>
                                                    {EXPENSE_CLASSES.map((expenseClass) => (
                                                        <td key={expenseClass} className="px-4 py-3 text-right tabular-nums">
                                                            {formatAmount(operatingUnit.expenseTotals[expenseClass] ?? 0)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
