'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { createCompensationRuleAction } from '@/src/actions/salary'
import { VALID_COMPENSATION_NAMES, MAX_SG } from '@/src/lib/constants'
import { Button } from '@/components/ui/button'
import { Info, X } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

export function NewCompensationRuleForm({ onClose }: { onClose: () => void }) {
    const [state, action, pending] = useActionState(createCompensationRuleAction, undefined)
    const [name, setName] = useState<string>(state?.values?.name ?? '')
    const [calcType, setCalcType] = useState<string>(state?.values?.calculation_type ?? 'fixed')
    const [frequency, setFrequency] = useState<string>(state?.values?.frequency ?? 'monthly')
    const [calculationHelpOpen, setCalculationHelpOpen] = useState(false)
    const calculationHelpRef = useRef<HTMLDivElement>(null)
    const todayDate = useMemo(() => {
        const d = new Date()
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }, [])

    useEffect(() => {
        // close on success
        if (state?.success) onClose()
    }, [state?.success, onClose])

    useEffect(() => {
        if (!calculationHelpOpen) return

        const handlePointerDown = (event: PointerEvent) => {
            if (!calculationHelpRef.current?.contains(event.target as Node)) {
                setCalculationHelpOpen(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [calculationHelpOpen])

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg">
                {/* header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <div>
                        <h2 className="text-lg font-bold">New Compensation Rule</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Set the rate for a benefit or allowance
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form action={action} className="px-6 py-5 space-y-4">
                    {state?.formErrors && (
                        <p className="text-red-500 text-sm">{state.formErrors[0]}</p>
                    )}

                    {/* name */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Benefit / Allowance</label>
                        <input type="hidden" name="name" value={name} />
                        <Select value={name} onValueChange={(value) => setName(value ?? '')}>
                            <SelectTrigger className="w-full border border-border bg-background text-sm">
                                <SelectValue placeholder="Select type...">
                                    {name || 'Select type...'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {VALID_COMPENSATION_NAMES.map(n => (
                                    <SelectItem key={n} value={n}>{n}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {state?.fieldErrors?.name && (
                            <p className="text-red-500 text-xs">{state.fieldErrors.name[0]}</p>
                        )}
                    </div>

                    {/* effective date */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium">Effective Date</label>
                        <input
                            name="effective_date"
                            type="date"
                            defaultValue={state?.values?.effective_date ?? todayDate}
                            className="border px-3 py-2 rounded bg-background w-full text-sm"
                            required
                        />
                        {state?.fieldErrors?.effective_date && (
                            <p className="text-red-500 text-xs">{state.fieldErrors.effective_date[0]}</p>
                        )}
                    </div>

                    {/* calculation type, frequency, and value */}
                    <div className="grid grid-cols-2 gap-3">
                        <div ref={calculationHelpRef} className="relative space-y-1">
                            <div className="flex items-center gap-1 align-center">
                                <label className="text-sm font-medium">Calculation Type</label>
                                <button
                                    type="button"
                                    onClick={() => setCalculationHelpOpen((open) => !open)}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    aria-label="Show calculation type help"
                                    aria-expanded={calculationHelpOpen}
                                >
                                    <Info className="h-4 w-4" />
                                </button>
                            </div>
                            {calculationHelpOpen && (
                                <section
                                    className="absolute left-0 top-8 z-20 w-[min(calc(100vw-3rem),26rem)] max-h-[25vh] rounded-2xl border border-border bg-background p-4 text-sm shadow-xl overflow-auto"
                                    aria-label="Calculation type descriptions"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                                Calculation Guide
                                            </p>
                                            <h3 className="mt-1 font-black text-secondary-foreground">Compensation Formulas</h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCalculationHelpOpen(false)}
                                            className="rounded-full border border-border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            aria-label="Close calculation type help"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <div className="mt-3 space-y-3">
                                        <div className="rounded-xl bg-muted p-3">
                                            <p className="font-bold text-secondary-foreground">Fixed Amount</p>
                                            <p className="mt-1 text-muted-foreground">Use for benefits with a fixed peso amount.</p>
                                            <p className="mt-1 font-mono text-xs text-secondary-foreground">amount x number of months x quantity</p>
                                        </div>
                                        <div className="rounded-xl bg-muted p-3">
                                            <p className="font-bold text-secondary-foreground">Salary Percentage</p>
                                            <p className="mt-1 text-muted-foreground">Use when the benefit is a percentage of the salary amount.</p>
                                            <p className="mt-1 font-mono text-xs text-secondary-foreground">salary x percentage</p>
                                            <p className="mt-1 text-xs text-muted-foreground">Enter amount as a whole number percentage (e.g. 12%).</p>
                                        </div>
                                        <div className="rounded-xl bg-muted p-3">
                                            <p className="font-bold text-secondary-foreground">Salary Multiplier</p>
                                            <p className="mt-1 text-muted-foreground">Use when the benefit is a multiple of the salary amount.</p>
                                            <p className="mt-1 font-mono text-xs text-secondary-foreground">salary x multiplier</p>
                                            <p className="mt-1 text-xs text-muted-foreground">Enter amount as a positive multiplier (e.g. 1 for one salary).</p>
                                        </div>
                                    </div>
                                </section>
                            )}
                            <input type="hidden" name="calculation_type" value={calcType} />
                            <Select value={calcType} onValueChange={(value) => setCalcType(value ?? 'fixed')}>
                                <SelectTrigger className="w-full border border-border bg-background text-sm">
                                    <SelectValue placeholder="Select calculation type">
                                        {calcType === 'fixed'
                                            ? 'Fixed Amount (PHP)'
                                            : calcType === 'percentage'
                                                ? 'Salary Percentage (%)'
                                                : 'Salary Multiplier'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fixed">Fixed Amount (PHP)</SelectItem>
                                    <SelectItem value="percentage">Salary Percentage (%)</SelectItem>
                                    <SelectItem value="salary_multiplier">Salary Multiplier</SelectItem>
                                </SelectContent>
                            </Select>
                            {state?.fieldErrors?.calculation_type && (
                                <p className="text-red-500 text-xs">{state.fieldErrors.calculation_type[0]}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium">Frequency</label>
                            <input type="hidden" name="frequency" value={frequency} />
                            <Select value={frequency} onValueChange={(value) => setFrequency(value ?? 'monthly')}>
                                <SelectTrigger className="w-full border border-border bg-background text-sm">
                                    <SelectValue placeholder="Select frequency">
                                        {frequency === 'annual' ? 'Annual' : 'Monthly'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="annual">Annual</SelectItem>
                                </SelectContent>
                            </Select>
                            {state?.fieldErrors?.frequency && (
                                <p className="text-red-500 text-xs">{state.fieldErrors.frequency[0]}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium">
                                {calcType === 'percentage' ? 'Rate (%)' : calcType === 'salary_multiplier' ? 'Multiplier' : 'Amount (PHP)'}
                            </label>
                            <input
                                name="rule_value"
                                type="number"
                                min={0}
                                step={calcType !== 'fixed' ? 0.01 : 1}
                                defaultValue={state?.values?.rule_value ?? ''}
                                placeholder={calcType === 'multiplier' ? 'e.g. 10.5' : (calcType === 'percentage' ? 'e.g. 12' : 'e.g. 2000')}
                                className="border px-3 py-2 rounded bg-background w-full text-sm"
                                required
                            />
                            {state?.fieldErrors?.rule_value && (
                                <p className="text-red-500 text-xs">{state.fieldErrors.rule_value[0]}</p>
                            )}
                        </div>
                    </div>

                    {/* SG range */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium">
                            Salary Grade Range
                            <span className="text-muted-foreground font-normal ml-1 text-xs">(leave default for all grades)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <input
                                    name="min_salary_grade"
                                    type="number"
                                    min={1}
                                    max={MAX_SG}
                                    defaultValue={state?.values?.min_salary_grade ?? '1'}
                                    placeholder="Min SG"
                                    className="border px-3 py-2 rounded bg-background w-full text-sm"
                                />
                                {state?.fieldErrors?.min_salary_grade && (
                                    <p className="text-red-500 text-xs">{state.fieldErrors.min_salary_grade[0]}</p>
                                )}
                            </div>
                            <div>
                                <input
                                    name="max_salary_grade"
                                    type="number"
                                    min={1}
                                    max={MAX_SG}
                                    defaultValue={state?.values?.max_salary_grade ?? String(MAX_SG)}
                                    placeholder="Max SG"
                                    className="border px-3 py-2 rounded bg-background w-full text-sm"
                                />
                                {state?.fieldErrors?.max_salary_grade && (
                                    <p className="text-red-500 text-xs">{state.fieldErrors.max_salary_grade[0]}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* footer */}
                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={pending} className="flex-1 bg-primary-foreground text-white hover:bg-primary-foreground/80">
                            {pending ? 'Saving...' : 'Save Rule'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
