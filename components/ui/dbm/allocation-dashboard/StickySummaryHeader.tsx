'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { BudgetCycle } from '@/src/types/budget_settings'
import type { AllocationDashboardTotals } from '@/src/db/postgres/repositories/budgetAllocationRepository'
import { formatAmount } from './shared'
import { BUDGET_PHASE_LABELS } from '@/src/lib/constants'

type Props = {
    activeCycle: BudgetCycle | null
    viewingYear: number | null
    totals: AllocationDashboardTotals
    showGaaTotals: boolean
}

export default function StickySummaryHeader({
    activeCycle,
    viewingYear,
    totals,
    showGaaTotals,
}: Props) {
    const [collapsed, setCollapsed] = useState(false)

    const variance = Math.round(totals.gaa_total - totals.nep_total)
    const hasDifference = variance !== 0
    const gaaExceedsNep = variance > 0

    return (
        <section className="sticky top-20 z-20 overflow-hidden rounded-2xl border border-secondary-foreground/20 bg-primary-foreground text-secondary shadow-sm backdrop-blur supports-[backdrop-filter]:bg-primary-foreground/70">
            <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className={`flex w-full items-center justify-between gap-4 px-5 py-4 text-left ${collapsed ? '' : 'border-b border-white/15'}`}
            >
                <div>
                    <p className="text-xs font-semibold uppercase text-white tracking-[0.18em]">
                        Budget Allocation Dashboard
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-black tracking-tight text-white">
                            FY {viewingYear ?? '—'}
                        </h1>
                        {activeCycle ? (
                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                                {BUDGET_PHASE_LABELS[activeCycle.current_phase]}
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-white">Variance</p>
                        <p className={`text-sm font-semibold ${
                            !showGaaTotals
                                ? 'text-white'
                                : !hasDifference
                                    ? 'text-white'
                                    : gaaExceedsNep
                                        ? 'text-amber-400'
                                        : 'text-green-200'
                        }`}>
                            {!showGaaTotals
                                ? '—'
                                : !hasDifference
                                    ? '0'
                                    : `${variance > 0 ? '+' : ''}${variance.toLocaleString('en-PH')}`}
                        </p>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-white transition-transform ${collapsed ? '' : 'rotate-180'}`} />
                </div>
            </button>

            <div className={`${collapsed ? 'hidden' : 'grid'} text-center gap-4 border-t border-white/10 bg-white/8 px-5 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-white/10 lg:grid-cols-[repeat(5,minmax(0,1fr))]`}>
                <div className='my-auto text-white'>
                    <p className="text-xs uppercase tracking-wide">Proposed Total</p>
                    <p className="mt-1 text-lg font-bold">
                        PHP {formatAmount(totals.proposed_total)}
                    </p>
                </div>

                <div className='my-auto text-white'>
                    <p className="text-xs uppercase tracking-wide">DBM Recommendation</p>
                    <p className="mt-1 text-lg font-bold">
                        PHP {formatAmount(totals.dbm_rec_total)}
                    </p>
                </div>

                <div className='my-auto text-white'>
                    <p className="text-xs uppercase tracking-wide">NEP Total</p>
                    <p className="mt-1 text-lg font-bold">
                        PHP {formatAmount(totals.nep_total)}
                    </p>
                </div>

                <div className='my-auto text-white'>
                    <p className="text-xs uppercase tracking-wide">GAA Total</p>
                    <p className="mt-1 text-lg font-bold">
                        {showGaaTotals ? `PHP ${formatAmount(totals.gaa_total)}` : '—'}
                    </p>
                </div>

                <div className='my-auto'>
                    <p className="text-xs uppercase tracking-wide text-white">Variance</p>
                    <p className={`mt-1 text-lg font-bold ${
                        !showGaaTotals
                            ? 'text-white'
                            : !hasDifference
                                ? 'text-white'
                                : gaaExceedsNep
                                    ? 'text-amber-400'
                                    : 'text-green-200'
                    }`}>
                        {!showGaaTotals
                            ? '—'
                            : !hasDifference
                                ? '0'
                                : `${variance > 0 ? '+' : ''}${variance.toLocaleString('en-PH')}`}
                    </p>
                    {showGaaTotals && hasDifference ? (
                        <p className={`mt-1 text-xs ${gaaExceedsNep ? 'font-semibold text-amber-400' : 'text-green-200'}`}>
                            {gaaExceedsNep ? 'GAA is higher than NEP.' : 'GAA differs from NEP.'}
                        </p>
                    ) : null}
                </div>
            </div>
        </section>
    )
}
