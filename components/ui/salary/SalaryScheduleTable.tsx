'use client'

import { useMemo } from 'react'

type Rate = {
    salary_grade: number
    step: number
    amount: string | number
}

type Schedule = {
    id: string
    circular_reference: string
    effective_date: string | Date
    rates: Rate[]
}

export function SalaryScheduleTable({ schedule }: { schedule: Schedule | null }) {
    const { steps, grades, rateMap } = useMemo(() => {
        if (!schedule?.rates?.length) return { steps: [], grades: [], rateMap: new Map() }

        const stepSet = new Set<number>()
        const gradeSet = new Set<number>()
        const map = new Map<string, number>()

        for (const r of schedule.rates) {
            stepSet.add(r.step)
            gradeSet.add(r.salary_grade)
            map.set(`${r.salary_grade}-${r.step}`, Number(r.amount))
        }

        return {
            steps: [...stepSet].sort((a, b) => a - b),
            grades: [...gradeSet].sort((a, b) => a - b),
            rateMap: map,
        }
    }, [schedule])

    const formatAmount = (amount: number) =>
        new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

    if (!schedule) {
        return (
            <div className="border border-dashed border-border rounded-lg p-16 text-center">
                <p className="text-muted-foreground text-sm">No salary schedule found.</p>
                <p className="text-muted-foreground text-xs mt-1">
                    Create a new salary schedule to get started.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* schedule metadata */}
            <div className="flex items-center gap-6 bg-muted/30 border border-border rounded-lg px-5 py-3">
                <div>
                    <p className="text-xs text-muted-foreground">Circular Reference</p>
                    <p className="font-semibold text-sm">{schedule.circular_reference}</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                    <p className="text-xs text-muted-foreground">Effective Date</p>
                    <p className="font-semibold text-sm">
                        {new Date(schedule.effective_date).toLocaleDateString('en-PH', {
                            year: 'numeric', month: 'long', day: 'numeric'
                        })}
                    </p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                    <p className="text-xs text-muted-foreground">Salary Grades</p>
                    <p className="font-semibold text-sm">{grades.length}</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                    <p className="text-xs text-muted-foreground">Steps per Grade</p>
                    <p className="font-semibold text-sm">{steps.length}</p>
                </div>
            </div>

            {/* scrollable table */}
            <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-auto max-h-[calc(100vh-360px)]">
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-10 bg-muted">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold border-b border-r border-border whitespace-nowrap bg-muted">
                                    Salary Grade
                                </th>
                                {steps.map(step => (
                                    <th
                                        key={step}
                                        className="px-4 py-3 text-right font-semibold border-b border-r border-border whitespace-nowrap bg-muted last:border-r-0"
                                    >
                                        Step {step}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {grades.map((sg, i) => (
                                <tr
                                    key={sg}
                                    className={`border-b border-border last:border-b-0 ${
                                        i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                                    }`}
                                >
                                    <td className="px-4 py-2.5 font-semibold border-r border-border whitespace-nowrap">
                                        SG {sg}
                                    </td>
                                    {steps.map(step => {
                                        const amount = rateMap.get(`${sg}-${step}`)
                                        return (
                                            <td
                                                key={step}
                                                className="px-4 py-2.5 text-right font-mono border-r border-border last:border-r-0 tabular-nums"
                                            >
                                                {amount != null
                                                    ? formatAmount(amount)
                                                    : <span className="text-muted-foreground">—</span>
                                                }
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}