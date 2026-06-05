'use client'

import { useActionState, useState } from 'react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from '@/components/ui/button'
import { editBudgetCycleAction } from '@/src/actions/budgetSettings'
import { BudgetCycle, BudgetCyclePhase } from '@/src/types/budget_settings'

const PREP_STATUS_OPTIONS = [
    { value: 'closed', label: 'Closed' },
    { value: 'active', label: 'Active' },
    { value: 'locked', label: 'Locked' },
]

const PHASE_OPTIONS: { value: BudgetCyclePhase; label: string }[] = [
    { value: 'preparation', label: 'Preparation' },
    { value: 'dbm_review', label: 'DBM Review' },
    { value: 'presidential_approval', label: 'Presidential Approval' },
    { value: 'legislative_deliberation', label: 'Legislative Deliberation' },
    { value: 'enacted_gaa', label: 'Enacted GAA' },
]

const PREP_STATUS_LABELS: Record<BudgetCycle['prep_status'], string> = {
    closed: 'Closed',
    active: 'Active',
    locked: 'Locked',
}

export function EditBudgetCycleForm({ cycle }: { cycle: BudgetCycle }) {
    const [state, action, pending] = useActionState(editBudgetCycleAction, undefined)
    const [selectedPrepStatus, setSelectedPrepStatus] = useState(state?.values?.prep_status ?? cycle.prep_status)
    const [selectedPhase, setSelectedPhase] = useState(state?.values?.current_phase ?? cycle.current_phase)

    const handlePrepStatusChange = (value: string | null) => {
        const nextStatus = value ?? 'closed'
        setSelectedPrepStatus(nextStatus)

        if (nextStatus === 'closed') {
            setSelectedPhase('preparation')
        } else if (nextStatus === 'locked') {
            setSelectedPhase('enacted_gaa')
        }
    }

    return (
        <form action={action} className="space-y-6 border border-border rounded-lg p-6">
            <input type="hidden" name="fiscal_year" value={cycle.fiscal_year} />

            {state?.formErrors?.[0] && (
                <p className="text-sm text-red-500 italic">{state.formErrors[0]}</p>
            )}

            <div className="space-y-2">
                <label htmlFor="fiscal_year" className="font-medium">Fiscal Year</label>
                <input
                    id="fiscal_year"
                    name="fiscal_year"
                    value={cycle.fiscal_year}
                    disabled
                    className="border border-border px-3 py-2 w-full my-1 rounded bg-muted text-muted-foreground"
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="prep_status" className="font-medium">Preparation Status</label>
                <input id="prep_status" name="prep_status" type="hidden" value={selectedPrepStatus} />
                <Select
                    value={selectedPrepStatus}
                    onValueChange={handlePrepStatusChange}
                >
                    <SelectTrigger className="border px-3 py-5 w-full rounded my-1 border-border text-base">
                        <SelectValue placeholder="Select a prep status">
                            {PREP_STATUS_LABELS[selectedPrepStatus as keyof typeof PREP_STATUS_LABELS]}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {PREP_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {state?.fieldErrors?.prep_status?.[0] && (
                    <p className="text-sm text-red-500 italic">{state.fieldErrors.prep_status[0]}</p>
                )}
            </div>

            <div className="space-y-2">
                <label htmlFor="current_phase" className="font-medium">Current Phase</label>
                <input id="current_phase" name="current_phase" type="hidden" value={selectedPhase} />
                <Select
                    value={selectedPhase}
                    onValueChange={(value) => setSelectedPhase(value ?? 'preparation')}
                    disabled={selectedPrepStatus !== 'active'}
                >
                    <SelectTrigger className="border px-3 py-5 w-full rounded my-1 border-border text-base">
                        <SelectValue placeholder="Select a current phase">
                            {PHASE_OPTIONS.find((option) => option.value === selectedPhase)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {PHASE_OPTIONS.filter((option) => option.value !== 'enacted_gaa').map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {state?.fieldErrors?.current_phase?.[0] && (
                    <p className="text-sm text-red-500 italic">{state.fieldErrors.current_phase[0]}</p>
                )}
                {selectedPrepStatus !== 'active' && (
                    <p className="text-xs text-muted-foreground">
                        Closed cycles reset to Preparation. Locked cycles are treated as Enacted GAA.
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <label htmlFor="legal_basis_ref" className="font-medium">Legal Basis Reference</label>
                <input
                    id="legal_basis_ref"
                    name="legal_basis_ref"
                    defaultValue={state?.values?.legal_basis_ref ?? cycle.legal_basis_ref ?? ''}
                    className="border border-border px-3 py-2 w-full my-1 rounded bg-background"
                    placeholder="Optional memo, order, or reference"
                />
            </div>

            <Button type="submit" disabled={pending} className="w-full bg-accent-foreground text-white hover:bg-accent-foreground/90 my-1 py-5 text-md">
                {pending ? 'Saving...' : 'Save Changes'}
            </Button>
        </form>
    )
}
