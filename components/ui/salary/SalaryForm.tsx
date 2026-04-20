'use client'

import { useActionState, useState, useEffect } from 'react'
import { createSalaryScheduleAction } from '@/src/actions/salary'
import { MAX_SG, MAX_STEP } from '@/src/lib/constants'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

type Rate = { salary_grade: number; step: number; amount: string }

const DEFAULT_STEPS = 8
const DEFAULT_SG = 33

function buildEmptyGrid(sgCount = DEFAULT_SG, stepCount = DEFAULT_STEPS): Rate[] {
    const rates: Rate[] = []
    for (let sg = 1; sg <= sgCount; sg++) {
        for (let step = 1; step <= stepCount; step++) {
            rates.push({ salary_grade: sg, step, amount: '' })
        }
    }
    return rates
}

export function NewSalaryScheduleForm({ onClose }: { onClose: () => void }) {
    const [state, action, pending] = useActionState(createSalaryScheduleAction, undefined)
    const [rates, setRates] = useState<Rate[]>(buildEmptyGrid())
    const [stepCount, setStepCount] = useState(DEFAULT_STEPS)
    const [sgCount, setSgCount] = useState(DEFAULT_SG)
    
    const [todayDate, setTodayDate] = useState('')

    useEffect(() => {
        // Generate today's date in YYYY-MM-DD format based on the user's local timezone
        const d = new Date()
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        setTodayDate(`${year}-${month}-${day}`)

        // close on success
        if (state?.success) onClose()
    }, [state?.success, onClose])

    const steps = Array.from({ length: stepCount }, (_, i) => i + 1)
    const grades = Array.from({ length: sgCount }, (_, i) => i + 1)

    const getRate = (sg: number, step: number) =>
        rates.find(r => r.salary_grade === sg && r.step === step)?.amount ?? ''

    const setRate = (sg: number, step: number, value: string) => {
        setRates(prev => {
            const existing = prev.findIndex(r => r.salary_grade === sg && r.step === step)
            if (existing >= 0) {
                const updated = [...prev]
                updated[existing] = { ...updated[existing], amount: value }
                return updated
            }
            return [...prev, { salary_grade: sg, step, amount: value }]
        })
    }

    const filledRates = rates.filter(r => r.amount && parseFloat(r.amount) > 0)

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                {/* header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                    <div>
                        <h2 className="text-lg font-bold">New Salary Schedule</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Enter rates for each Salary Grade and Step combination
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form action={(fd) => {
                    fd.set('rates', JSON.stringify(filledRates))
                    action(fd)
                }} className="flex flex-col flex-1 overflow-hidden">
                    {/* metadata fields */}
                    <div className="px-6 py-4 border-b border-border shrink-0">
                        {state?.formErrors && (
                            <p className="text-red-500 text-sm mb-3">{state.formErrors[0]}</p>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">
                                    Circular Reference
                                </label>
                                <input
                                    name="circular_reference"
                                    placeholder="e.g. DBM-OSHB No. 2024-1"
                                    defaultValue={state?.values?.circular_reference ?? ''}
                                    className="border px-3 py-2 rounded bg-background w-full text-sm"
                                    required
                                />
                                {state?.fieldErrors?.circular_reference && (
                                    <p className="text-red-500 text-xs">{state.fieldErrors.circular_reference[0]}</p>
                                )}
                            </div>
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
                        </div>

                        {/* grid size controls */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span>Grid size:</span>
                            <label className="flex items-center gap-1">
                                SG 1 -
                                <input
                                    type="number"
                                    min={1}
                                    max={MAX_SG}
                                    value={sgCount}
                                    onChange={e => setSgCount(Number(e.target.value))}
                                    className="w-14 border px-1 py-0.5 rounded bg-background text-xs text-center"
                                />
                            </label>
                            <label className="flex items-center gap-1">
                                Steps 1 -
                                <input
                                    type="number"
                                    min={1}
                                    max={MAX_STEP}
                                    value={stepCount}
                                    onChange={e => setStepCount(Number(e.target.value))}
                                    className="w-14 border px-1 py-0.5 rounded bg-background text-xs text-center"
                                />
                            </label>
                            <span className="ml-auto text-muted-foreground">
                                {filledRates.length} rates filled
                            </span>
                        </div>
                    </div>

                    {/* rate grid */}
                    <div className="flex-1 overflow-auto px-6 py-4">
                        <table className="border-collapse text-xs mx-auto w-max">
                            <thead>
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold border border-border bg-muted sticky left-0 z-10">
                                        SG
                                    </th>
                                    {steps.map(step => (
                                        <th
                                            key={step}
                                            className="px-2 py-2 text-center font-semibold border border-border bg-muted whitespace-nowrap"
                                        >
                                            <div>Step {step}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {grades.map(sg => (
                                    <tr key={sg}>
                                        <td className="px-3 py-1 font-semibold border border-border bg-muted/50 sticky left-0 text-center">
                                            {sg}
                                        </td>
                                        {steps.map(step => (
                                            <td key={step} className="border border-border p-0">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step={0.01}
                                                    value={getRate(sg, step)}
                                                    onChange={e => setRate(sg, step, e.target.value)}
                                                    className="w-24 px-2 py-1.5 text-right font-mono bg-background focus:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 bg-muted/20">
                        <p className="text-xs text-muted-foreground">
                            Leave cells empty to skip that grade/step combination.
                        </p>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={pending || filledRates.length === 0} className="bg-primary-foreground hover:bg-primary-foreground/80 text-white">
                                {pending ? 'Saving...' : 'Save Schedule'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}