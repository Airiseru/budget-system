'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { BudgetCycle, BudgetCyclePhase } from '@/src/types/budget_settings'
import { BUDGET_PHASE_LABELS, BUDGET_PHASE_OPTIONS } from '@/src/lib/constants'
import BudgetCycleSignatureButton from './BudgetCycleSignatureButton'

const STATUS_STYLES: Record<BudgetCycle['prep_status'], string> = {
    closed: 'bg-slate-100 text-slate-700',
    active: 'bg-emerald-600 text-white',
    locked: 'bg-amber-600 text-white',
}

export function BudgetCycleManager({
    cycles,
    activeCycle,
    canManage,
}: {
    cycles: BudgetCycle[]
    activeCycle: BudgetCycle | null
    canManage: boolean
}) {
    const [historyOpen, setHistoryOpen] = useState(false)
    const [selectedPhase, setSelectedPhase] = useState(activeCycle?.current_phase ?? 'preparation')
    const [startFiscalYear, setStartFiscalYear] = useState(String(new Date().getFullYear() + 1))
    const [startLegalBasisRef, setStartLegalBasisRef] = useState('')

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <div className="border border-border rounded-lg p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold">Start Budget Cycle</h2>
                        <p className="text-sm text-muted-foreground">
                            Start a fiscal year cycle in the preparation phase when there is no other active cycle.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label htmlFor="fiscal_year" className="font-medium">Fiscal Year</label>
                            <input
                                id="fiscal_year"
                                type="number"
                                min="2000"
                                max="9999"
                                value={startFiscalYear}
                                onChange={(event) => setStartFiscalYear(event.target.value)}
                                className="border border-border px-3 py-2 w-full my-1 rounded bg-background"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="legal_basis_ref" className="font-medium">Legal Basis Reference</label>
                            <input
                                id="legal_basis_ref"
                                value={startLegalBasisRef}
                                onChange={(event) => setStartLegalBasisRef(event.target.value)}
                                className="border border-border px-3 py-2 w-full my-1 rounded bg-background"
                                placeholder="Optional memo, order, or reference"
                            />
                        </div>

                        <BudgetCycleSignatureButton
                            action="start_cycle"
                            fiscalYear={Number(startFiscalYear)}
                            legalBasisRef={startLegalBasisRef}
                            disabled={!canManage || !Number.isFinite(Number(startFiscalYear))}
                            className="w-full bg-accent-foreground text-white hover:bg-accent-foreground/90 text-md py-5 my-1"
                        >
                            Create / Start Cycle
                        </BudgetCycleSignatureButton>
                    </div>
                </div>

                <div className="border border-border rounded-lg p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold">Current Preparation Phase</h2>
                            <p className="text-sm text-muted-foreground">
                                Active cycles are ongoing. Locked cycles have passed the deadline.
                            </p>
                        </div>

                        {activeCycle && canManage && (
                            <BudgetCycleSignatureButton
                                action="change_phase"
                                fiscalYear={activeCycle.fiscal_year}
                                currentPhase="enacted_gaa"
                                legalBasisRef={activeCycle.legal_basis_ref ?? ''}
                                className="bg-destructive text-white hover:bg-destructive/90 text-md py-5"
                            >
                                Stop Current Cycle
                            </BudgetCycleSignatureButton>
                        )}
                    </div>

                    {activeCycle ? (
                        <div className="rounded-lg border border-border p-4 space-y-2">
                            <div className="flex items-center gap-3">
                                <h3 className="font-semibold">FY {activeCycle.fiscal_year}</h3>
                                <Badge className={STATUS_STYLES[activeCycle.prep_status]}>
                                    {activeCycle.prep_status.toUpperCase()}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Opened: {activeCycle.prep_opened_at ? new Date(activeCycle.prep_opened_at).toLocaleString() : '—'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Current phase: {BUDGET_PHASE_LABELS[activeCycle.current_phase]}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Legal basis: {activeCycle.legal_basis_ref || '—'}
                            </p>

                            {canManage && (
                                <div className="pt-4 space-y-3 border-t border-border">
                                    <div className="space-y-2">
                                        <label htmlFor="current_phase_select" className="font-medium">
                                            Change Current Phase
                                        </label>
                                        <Select
                                            value={selectedPhase}
                                            onValueChange={(value) => setSelectedPhase((value ?? 'preparation') as BudgetCyclePhase)}
                                        >
                                            <SelectTrigger id="current_phase_select" className="w-full border-border py-5 text-base">
                                                <SelectValue placeholder="Select a phase">
                                                    {BUDGET_PHASE_LABELS[selectedPhase]}
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {BUDGET_PHASE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <BudgetCycleSignatureButton
                                        action="change_phase"
                                        fiscalYear={activeCycle.fiscal_year}
                                        currentPhase={selectedPhase}
                                        legalBasisRef={activeCycle.legal_basis_ref ?? ''}
                                        disabled={selectedPhase === activeCycle.current_phase}
                                        className="w-full bg-accent-foreground text-white hover:bg-accent-foreground/90 text-md py-5"
                                    >
                                        Update Current Phase
                                    </BudgetCycleSignatureButton>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                            There is no active budget cycle.
                        </div>
                    )}
                </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
                <button
                    type="button"
                    onClick={() => setHistoryOpen((open) => !open)}
                    className="w-full border-b border-border px-6 py-4 flex items-center justify-between text-left"
                >
                    <h2 className="text-lg font-semibold">Cycle History</h2>
                    <span className="text-sm text-muted-foreground">
                        {historyOpen ? 'Hide' : 'Show'}
                    </span>
                </button>

                {historyOpen && (
                    cycles.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground">No budget cycles found.</div>
                    ) : (
                        <div className="divide-y divide-border max-h-96 overflow-y-auto">
                            {cycles.map((cycle) => (
                                <div key={cycle.fiscal_year} className="px-6 py-4 flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="font-semibold">FY {cycle.fiscal_year}</h3>
                                            <Badge className={STATUS_STYLES[cycle.prep_status]}>
                                                {cycle.prep_status.toUpperCase()}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Opened: {cycle.prep_opened_at ? new Date(cycle.prep_opened_at).toLocaleString() : '—'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Phase: {BUDGET_PHASE_LABELS[cycle.current_phase]}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Locked: {cycle.prep_locked_at ? new Date(cycle.prep_locked_at).toLocaleString() : '—'}
                                        </p>
                                    </div>

                                    <div className="text-right text-sm text-muted-foreground space-y-2 flex flex-col">
                                        {canManage && (
                                            <Link href={`/dbm/settings/cycles/${cycle.fiscal_year}`} className=''>
                                                <Button variant="outline" size="sm">Edit</Button>
                                            </Link>
                                        )}
                                        <div>
                                            <p>Legal Basis</p>
                                            <p>{cycle.legal_basis_ref || '—'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
