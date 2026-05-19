'use client'

import { useEffect, useState } from 'react'
import { MessageSquareText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
    AllocationDashboardRow,
    AllocationWorkflowLogEntry,
} from '@/src/db/postgres/repositories/budgetAllocationRepository'
import { formatAmount, formatDateTime } from './shared'

const STAGE_LABELS: Record<string, string> = {
    dbm_review: 'DBM Review',
    presidential_review: 'Presidential Approval',
    congressional_bicam: 'Legislative Deliberation',
    entity: 'Entity',
    dbm_appeal: 'DBM Appeal',
}

type Props = {
    row: AllocationDashboardRow | null
    open: boolean
    onClose: () => void
}

export default function AllocationHistoryDrawer({ row, open, onClose }: Props) {
    const [logs, setLogs] = useState<AllocationWorkflowLogEntry[]>([])
    const [loading, setLoading] = useState(open && !!row)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open || !row) return

        let active = true

        fetch(`/api/dbm/allocations/${row.id}`)
            .then(async (response) => {
                const result = await response.json()
                if (!response.ok) {
                    throw new Error(result.error || 'Failed to load allocation history.')
                }
                return result
            })
            .then((result) => {
                if (!active) return
                setLogs(result.logs ?? [])
            })
            .catch((fetchError: unknown) => {
                if (!active) return
                setError(fetchError instanceof Error ? fetchError.message : 'Failed to load allocation history.')
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [open, row])

    return (
        <>
            <div
                className={`fixed inset-0 z-40 bg-black/25 transition-opacity mb-0 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                onClick={onClose}
            />
            <aside
                className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
                aria-hidden={!open}
            >
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                    <div>
                        <div className="flex items-center gap-2 text-secondary-foreground">
                            <MessageSquareText className="h-4 w-4" />
                            <h2 className="text-lg font-semibold">Allocation Timeline</h2>
                        </div>
                        {row ? (
                            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                <p className="font-medium text-secondary-foreground">{row.item_name}</p>
                                <p>{row.pap_title ?? 'No PAP'}</p>
                                <p>{row.department_name ?? '00'} • {row.agency_name ?? '000'} • {row.operating_unit_name ?? '0000000'}</p>
                            </div>
                        ) : null}
                    </div>
                    <Button type="button" variant="outline" size="icon-sm" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Loading activity history...</p>
                    ) : error ? (
                        <p className="text-sm text-red-700">{error}</p>
                    ) : logs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No allocation activity recorded yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log) => (
                                <article key={log.id} className="rounded-xl border border-border bg-muted/20 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-secondary-foreground">
                                                {STAGE_LABELS[log.workflow_stage] ?? log.workflow_stage}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {log.performed_by_name ?? 'Unknown reviewer'}
                                            </p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDateTime(log.created_at)}
                                        </p>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-secondary-foreground">
                                        {log.remarks}
                                    </p>
                                    {(log.amt_before !== null || log.amt_after !== null) ? (
                                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-lg bg-background px-3 py-2">
                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Before</p>
                                                <p className="mt-1 text-sm font-medium text-secondary-foreground">
                                                    {log.amt_before === null ? '—' : `PHP ${formatAmount(Number(log.amt_before))}`}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-background px-3 py-2">
                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">After</p>
                                                <p className="mt-1 text-sm font-medium text-secondary-foreground">
                                                    {log.amt_after === null ? '—' : `PHP ${formatAmount(Number(log.amt_after))}`}
                                                </p>
                                            </div>
                                        </div>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </>
    )
}
