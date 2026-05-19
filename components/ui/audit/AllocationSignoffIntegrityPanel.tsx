'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Lock, PackageCheck, ShieldCheck, ShieldX, Unlock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type AllocationIntegrityDebugState = {
    currentState?: unknown
    cryptographicValid?: boolean
    signatoryRowsValid?: boolean
    authorizationSnapshotsValid?: boolean
    stateHashValid?: boolean
    isSignedSnapshotValid?: boolean
    isAllocationAuditTrailValid?: boolean
    allocationAuditMismatchCount?: number
    allocationAuditLogsChecked?: number
    allocationAuditMismatches?: unknown[]
    isDataMatch?: boolean
}

export type AllocationSignoffIntegrityResult = {
    isTimelineIntact: boolean
    isSealedRootValid: boolean
    timelineBrokenAt: string | null
    isDataMatch: boolean
    isSignedSnapshotValid?: boolean
    isAllocationAuditTrailValid?: boolean
    allocationAuditMismatchCount?: number
    allocationAuditLogsChecked?: number
    allocationAuditMismatches?: unknown[]
    currentGlobalRoot: string | null
    lastSealedRoot: string | null
    totalEntityEvents: number
    formEventCount: number
    debugState?: AllocationIntegrityDebugState | null
    formLogs: Array<{
        id: string
        entity_id: string
        user_id: string
        event_type: string
        table_name: string | null
        record_id: string | null
        payload: Record<string, unknown> | string | null
        changed_at: string | Date
        prev_hash: string | null
        hash: string
        public_key_snapshot: string | null
        signature: string | null
        isSealed: boolean
    }>
}

function formatDebugValue(value: unknown) {
    if (value === undefined || value === null) return 'Not available'

    try {
        return JSON.stringify(value, null, 2)
    } catch {
        return String(value)
    }
}

function getSnapshotFailureReasons(result: AllocationSignoffIntegrityResult) {
    const reasons: string[] = []
    const debugState = result.debugState

    if (debugState?.cryptographicValid === false) {
        reasons.push('At least one signoff signature failed cryptographic verification.')
    }
    if (debugState?.signatoryRowsValid === false) {
        reasons.push('A signed allocation event does not match its immutable signatory record.')
    }
    if (debugState?.authorizationSnapshotsValid === false) {
        reasons.push('A signer authorization snapshot does not match the required workflow role/access level.')
    }
    if (debugState?.stateHashValid === false || result.isSignedSnapshotValid === false) {
        reasons.push('The signed allocation snapshot hash does not match the current canonical allocation package.')
    }
    if (result.isAllocationAuditTrailValid === false) {
        reasons.push(`The allocation patch trail has ${result.allocationAuditMismatchCount ?? 'one or more'} mismatch(es).`)
    }

    return reasons.length > 0 ? reasons : ['The allocation signoff package does not match the verified integrity checks.']
}

export default function AllocationSignoffIntegrityPanel({
    result,
    signoffType,
}: {
    result: AllocationSignoffIntegrityResult | null
    signoffType: 'nep' | 'gaa'
}) {
    const [showLogs, setShowLogs] = useState(false)
    const [showDetails, setShowDetails] = useState(false)

    if (!result) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
                <ShieldX className="h-4 w-4" />
                No allocation signoff audit data found.
            </div>
        )
    }

    const signedSnapshotValid = result.isSignedSnapshotValid !== false
    const allocationTrailValid = result.isAllocationAuditTrailValid !== false
    const isFullyValid =
        result.isTimelineIntact &&
        result.isSealedRootValid &&
        result.isDataMatch &&
        signedSnapshotValid &&
        allocationTrailValid
    const Icon = isFullyValid ? ShieldCheck : ShieldX
    const signoffLabel = signoffType.toUpperCase()
    const headerBg = isFullyValid ? 'bg-emerald-50/50' : 'bg-destructive/10'
    const headerText = isFullyValid ? 'text-emerald-900' : 'text-destructive'
    const mismatchReasons = getSnapshotFailureReasons(result)

    return (
        <div className="overflow-hidden rounded-lg border border-border shadow-sm">
            <div className={`flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between ${headerBg}`}>
                <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${isFullyValid ? 'text-emerald-600' : 'text-destructive'}`} />
                    <div>
                        <p className={`text-sm font-medium ${headerText}`}>
                            {isFullyValid
                                ? `${signoffLabel} allocation package is cryptographically secured`
                                : `${signoffLabel} allocation integrity check failed`}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Verified against {result.totalEntityEvents} ledger event(s) across allocation owner entities.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={result.isTimelineIntact ? 'default' : 'destructive'} className={result.isTimelineIntact ? 'bg-emerald-600 text-white' : ''}>
                        Ledger: {result.isTimelineIntact ? 'Intact' : 'Broken'}
                    </Badge>
                    <Badge variant={signedSnapshotValid ? 'outline' : 'destructive'} className={signedSnapshotValid ? 'border-emerald-600 bg-white text-emerald-700' : 'bg-white'}>
                        Signed Snapshot: {signedSnapshotValid ? 'Matched' : 'Mismatch'}
                    </Badge>
                    <Badge variant={allocationTrailValid ? 'outline' : 'destructive'} className={allocationTrailValid ? 'border-emerald-600 bg-white text-emerald-700' : 'bg-white'}>
                        Patch Trail: {allocationTrailValid ? 'Matched' : 'Mismatch'}
                    </Badge>
                    <Badge variant={result.isSealedRootValid ? 'outline' : 'destructive'} className={result.isSealedRootValid ? 'border-emerald-600 bg-white text-emerald-700' : 'bg-white'}>
                        Daily Seal: {result.isSealedRootValid ? 'Usable' : 'Unavailable'}
                    </Badge>
                </div>
            </div>

            <div className="space-y-4 bg-white p-4 text-sm">
                {!result.isTimelineIntact && result.timelineBrokenAt ? (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                        <strong>Chain broken at log ID:</strong> <span className="font-mono">{result.timelineBrokenAt}</span>
                    </div>
                ) : null}

                {!isFullyValid ? (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                        <div className="flex gap-2">
                            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />
                            <div className="flex-1 space-y-2">
                                <p>
                                    <strong>Allocation Signoff Mismatch:</strong> The signed checkpoint and/or compact allocation
                                    patch trail does not match the current allocation package.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowDetails((current) => !current)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
                                >
                                    {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    {showDetails ? 'Hide details' : 'Show details'}
                                </button>
                            </div>
                        </div>

                        {showDetails ? (
                            <div className="mt-3 space-y-3 rounded-md border border-destructive/20 bg-white p-3 text-slate-700">
                                <div>
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-destructive">Detected Cause</p>
                                    <ul className="list-disc space-y-1 pl-4">
                                        {mismatchReasons.map((reason) => (
                                            <li key={reason}>{reason}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="grid gap-2 md:grid-cols-2">
                                    {[
                                        ['Signature cryptographic checks', result.debugState?.cryptographicValid],
                                        ['Signatory rows match audit events', result.debugState?.signatoryRowsValid],
                                        ['Authorization snapshots match workflow', result.debugState?.authorizationSnapshotsValid],
                                        ['Signed snapshot hash matches package', result.debugState?.stateHashValid],
                                        ['Allocation patch trail matches package', result.isAllocationAuditTrailValid],
                                    ].map(([label, value]) => (
                                        <div key={String(label)} className="flex items-center justify-between gap-2 rounded border bg-slate-50 px-2 py-1.5">
                                            <span>{label}</span>
                                            <Badge variant={value === false ? 'destructive' : 'outline'} className={value === false ? '' : 'border-emerald-600 bg-white text-emerald-700'}>
                                                {value === false ? 'Failed' : value === true ? 'Passed' : 'N/A'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>

                                {result.allocationAuditMismatches?.length ? (
                                    <div>
                                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Allocation Patch Trail Mismatches
                                        </p>
                                        <pre className="max-h-48 overflow-auto rounded border bg-slate-50 p-2 text-[10px] text-slate-600">
                                            {formatDebugValue(result.allocationAuditMismatches)}
                                        </pre>
                                    </div>
                                ) : null}

                                <div>
                                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Current Canonical Allocation Package
                                    </p>
                                    <pre className="max-h-48 overflow-auto rounded border bg-slate-50 p-2 text-[10px] text-slate-600">
                                        {formatDebugValue(result.debugState?.currentState)}
                                    </pre>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {!result.isSealedRootValid ? (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                        <strong>Seal Checkpoint Unavailable:</strong> The published seal can no longer anchor one or more allocation timelines.
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 border-b border-border/50 pb-4 md:grid-cols-2">
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Seal Reference</p>
                        <p className="break-all rounded border bg-slate-50 p-2 font-mono text-[10px] text-slate-600">
                            {result.currentGlobalRoot || 'Not computed during standard verification'}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Sealed Root</p>
                        <p className="break-all rounded border bg-slate-50 p-2 font-mono text-[10px] text-slate-600">
                            {result.lastSealedRoot || 'No nightly seal published yet'}
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded border bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Signoff Events</p>
                        <p className="mt-1 text-2xl font-semibold">{result.formEventCount}</p>
                    </div>
                    <div className="rounded border bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Patch Logs Checked</p>
                        <p className="mt-1 text-2xl font-semibold">{result.allocationAuditLogsChecked ?? 0}</p>
                    </div>
                    <div className="rounded border bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Patch Mismatches</p>
                        <p className={`mt-1 text-2xl font-semibold ${(result.allocationAuditMismatchCount ?? 0) > 0 ? 'text-destructive' : 'text-emerald-700'}`}>
                            {result.allocationAuditMismatchCount ?? 0}
                        </p>
                    </div>
                </div>

                {result.formLogs.length > 0 ? (
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowLogs((current) => !current)}
                            className="flex items-center gap-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
                        >
                            {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {showLogs ? 'Hide allocation audit trail' : `View allocation audit trail (${result.formEventCount} events)`}
                        </button>

                        {showLogs ? (
                            <div className="mt-4 space-y-4 pl-2">
                                {result.formLogs.map((log, index) => (
                                    <div key={log.id} className="relative pl-6">
                                        <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-slate-300 ring-1 ring-slate-200" />
                                        {index < result.formLogs.length - 1 ? (
                                            <div className="absolute bottom-[-1rem] left-1 top-3.5 w-px bg-slate-200" />
                                        ) : null}

                                        <div className="pb-2">
                                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                                                    {log.event_type}
                                                </Badge>
                                                <div className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${log.isSealed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                                    {log.isSealed ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                                    {log.isSealed ? 'Sealed' : 'Pending Seal'}
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    Entity: <span className="font-mono text-[10px] text-slate-600">{log.entity_id}</span>
                                                </span>
                                                <span className="ml-auto text-xs text-muted-foreground">
                                                    {new Date(log.changed_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <pre className="max-h-32 overflow-auto rounded border bg-slate-50 p-2 text-[10px] text-slate-600">
                                                {formatDebugValue(log.payload)}
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    )
}
