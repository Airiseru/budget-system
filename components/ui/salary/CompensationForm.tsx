'use client'

import { useActionState, useState, useEffect } from 'react'
import { createCompensationRuleAction } from '@/src/actions/salary'
import { VALID_COMPENSATION_NAMES, MAX_SG } from '@/src/lib/constants'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function NewCompensationRuleForm({ onClose }: { onClose: () => void }) {
    const [state, action, pending] = useActionState(createCompensationRuleAction, undefined)
    const [calcType, setCalcType] = useState<string>(state?.values?.calculation_type ?? 'fixed')
    const [frequency, setFrequency] = useState<string>(state?.values?.frequency ?? 'monthly')

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

    useEffect(() => {
        if (state?.success) onClose()
    }, [state?.success])

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
                        <select
                            name="name"
                            defaultValue={state?.values?.name ?? ''}
                            className="border px-3 py-2 rounded bg-background w-full text-sm"
                            required
                        >
                            <option value="" disabled>Select type...</option>
                            {VALID_COMPENSATION_NAMES.map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
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
                        <div className="space-y-1">
                            <label className="text-sm font-medium">Calculation Type</label>
                            <select
                                name="calculation_type"
                                value={calcType}
                                onChange={e => setCalcType(e.target.value)}
                                className="border px-3 py-2 rounded bg-background w-full text-sm"
                                required
                            >
                                <option value="fixed">Fixed Amount (PHP)</option>
                                <option value="percentage">Percentage (%)</option>
                                <option value="salary_multiplier">Salary Multiplier</option>
                            </select>
                            {state?.fieldErrors?.calculation_type && (
                                <p className="text-red-500 text-xs">{state.fieldErrors.calculation_type[0]}</p>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium">Frequency</label>
                            <select
                                name="frequency"
                                value={frequency}
                                onChange={e => setFrequency(e.target.value)}
                                className="border px-3 py-2 rounded bg-background w-full text-sm"
                                required
                            >
                                <option value="monthly">Monthly</option>
                                <option value="annual">Annual</option>
                            </select>
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
                                placeholder={calcType !== 'fixed' ? 'e.g. 10.5' : 'e.g. 2000'}
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