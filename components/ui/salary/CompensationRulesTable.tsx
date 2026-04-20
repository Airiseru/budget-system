'use client'

type CompensationRule = {
    id: string
    name: string
    effective_date: string | Date
    calculation_type: string
    frequency: string
    rule_value: string | number
    min_salary_grade: number
    max_salary_grade: number
}

const TYPE_LABEL = {
    fixed: 'Fixed',
    percentage: 'Percentage',
    salary_multiplier: 'Salary Multiplier',
    value_multiplier: 'Value Multiplier',
}

export function CompensationRulesTable({ rules }: { rules: CompensationRule[] }) {
    const formatValue = (type: string, value: string | number) => {
        const num = Number(value)
        if (type === 'percentage') return `${num}%`

        return new Intl.NumberFormat('en-PH', {
            style: 'currency', currency: 'PHP'
        }).format(num)
    }

    if (rules.length === 0) {
        return (
            <div className="border border-dashed border-border rounded-lg p-16 text-center">
                <p className="text-muted-foreground text-sm">No compensation rules found.</p>
                <p className="text-muted-foreground text-xs mt-1">
                    Create a new compensation rule to get started.
                </p>
            </div>
        )
    }

    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-360px)]">
                <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-muted z-10">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold border-b border-r border-border">
                                Benefit / Allowance
                            </th>
                            <th className="px-4 py-3 text-left font-semibold border-b border-r border-border">
                                Type
                            </th>
                            <th className="px-4 py-3 text-left font-semibold border-b border-r border-border">
                                Frequency
                            </th>
                            <th className="px-4 py-3 text-right font-semibold border-b border-r border-border">
                                Value
                            </th>
                            <th className="px-4 py-3 text-center font-semibold border-b border-r border-border">
                                SG Range
                            </th>
                            <th className="px-4 py-3 text-left font-semibold border-b border-border">
                                Effective Date
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rules.map((rule, i) => (
                            <tr
                                key={rule.id}
                                className={`border-b border-border last:border-b-0 ${
                                    i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                                }`}
                            >
                                <td className="px-4 py-3 font-medium border-r border-border">
                                    {rule.name}
                                </td>
                                <td className="px-4 py-3 border-r border-border">
                                    {TYPE_LABEL[rule.calculation_type as keyof typeof TYPE_LABEL ?? ""] || rule.calculation_type}
                                </td>
                                <td className="px-4 py-3 border-r border-border capitalize">
                                    {rule.frequency}
                                </td>
                                <td className="px-4 py-3 text-right font-mono border-r border-border tabular-nums">
                                    {formatValue(rule.calculation_type, rule.rule_value)}
                                </td>
                                <td className="px-4 py-3 text-center border-r border-border text-muted-foreground">
                                    {rule.min_salary_grade === 1 && rule.max_salary_grade === 33
                                        ? 'All grades'
                                        : rule.min_salary_grade === rule.max_salary_grade ?
                                            `SG ${rule.min_salary_grade}` : `SG ${rule.min_salary_grade} - ${rule.max_salary_grade}`
                                    }
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {new Date(rule.effective_date).toLocaleDateString('en-PH', {
                                        year: 'numeric', month: 'short', day: 'numeric'
                                    })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}