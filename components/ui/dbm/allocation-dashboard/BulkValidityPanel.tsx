'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { EXPENSE_CLASSES } from '@/src/lib/constants'
import type { BulkValidityState } from './shared'

type Props = {
    open: boolean
    onToggle: () => void
    value: BulkValidityState
    onChange: (value: BulkValidityState) => void
    loading: boolean
    status: string | null
    error: string | null
    onApply: () => void
}

export default function BulkValidityPanel({
    open,
    onToggle,
    value,
    onChange,
    loading,
    status,
    error,
    onApply,
}: Props) {
    const FIELD_CLASSNAME = 'h-auto min-h-12 w-full rounded-md border-border px-3 py-3 text-md'

    return (
        <section className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm">
            <button
                type="button"
                onClick={onToggle}
                className={`flex w-full items-center justify-between px-4 py-4 text-left ${open ? 'border-b border-border' : ''}`}
            >
                <div>
                    <h2 className="text-lg font-semibold text-secondary-foreground">Bulk Validity</h2>
                    <p className="text-sm text-muted-foreground">
                        Apply validity dates to all line items, one expense class, or an expense class and tier.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{open ? 'Hide' : 'Show'}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {open ? (
                <div className="space-y-4 px-4 py-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2">
                            <p className="font-medium">Scope</p>
                            <Select
                                value={value.scope}
                                onValueChange={(next) =>
                                    onChange(
                                        (next ?? 'all') === 'all'
                                            ? { ...value, scope: 'all', expense_class: '' }
                                            : (next ?? 'all') === 'expense_class'
                                                ? { ...value, scope: 'expense_class', expense_class: value.expense_class || 'PS' }
                                                : (next ?? 'all') === 'tier'
                                                    ? { ...value, scope: 'tier', expense_class: '' }
                                                    : { ...value, scope: 'expense_class_and_tier', expense_class: value.expense_class || 'PS' }
                                    )
                                }
                            >
                                <SelectTrigger className={FIELD_CLASSNAME}>
                                    <SelectValue>
                                        {value.scope === 'all'
                                            ? 'All line items'
                                            : value.scope === 'expense_class'
                                                ? 'Expense class only'
                                                : value.scope === 'tier'
                                                    ? 'Tier only'
                                                    : 'Expense class and tier'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All line items</SelectItem>
                                    <SelectItem value="expense_class">Expense class only</SelectItem>
                                    <SelectItem value="tier">Tier only</SelectItem>
                                    <SelectItem value="expense_class_and_tier">Expense class and tier</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <p className="font-medium">Expense Class</p>
                            <Select
                                value={value.expense_class}
                                onValueChange={(next) => onChange({ ...value, expense_class: next ?? '' })}
                                disabled={!['expense_class', 'expense_class_and_tier'].includes(value.scope)}
                            >
                                <SelectTrigger className={FIELD_CLASSNAME}>
                                    <SelectValue>
                                        {value.expense_class
                                            ? `${value.expense_class} • ${EXPENSE_CLASSES[value.expense_class] ?? value.expense_class}`
                                            : 'Select expense class'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(EXPENSE_CLASSES).map(([code, label]) => (
                                        <SelectItem key={code} value={code}>
                                            {code} • {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <p className="font-medium">Tier</p>
                            <Select
                                value={value.tier}
                                onValueChange={(next) => onChange({ ...value, tier: (next ?? '1') as '1' | '2' })}
                                disabled={!['tier', 'expense_class_and_tier'].includes(value.scope)}
                            >
                                <SelectTrigger className={FIELD_CLASSNAME}>
                                    <SelectValue>{value.tier === '1' ? 'Tier 1' : 'Tier 2'}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Tier 1</SelectItem>
                                    <SelectItem value="2">Tier 2</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <p className="font-medium">Valid From</p>
                            <input
                                type="date"
                                value={value.valid_from}
                                onChange={(event) => onChange({ ...value, valid_from: event.target.value })}
                                className="h-auto min-h-12 w-full rounded-md border border-border bg-background px-3 py-3 text-md"
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="font-medium">Valid Until</p>
                            <input
                                type="date"
                                value={value.valid_until}
                                onChange={(event) => onChange({ ...value, valid_until: event.target.value })}
                                className="h-auto min-h-12 w-full rounded-md border border-border bg-background px-3 py-3 text-md"
                            />
                        </div>
                    </div>

                    {error ? <p className="text-sm text-red-700">{error}</p> : null}
                    {status ? <p className="text-sm text-emerald-700">{status}</p> : null}

                    <Button
                        type="button"
                        onClick={onApply}
                        disabled={loading}
                        className="bg-accent-foreground text-white hover:bg-accent-foreground/90"
                    >
                        {loading ? 'Applying...' : 'Apply Bulk Validity'}
                    </Button>
                </div>
            ) : null}
        </section>
    )
}
