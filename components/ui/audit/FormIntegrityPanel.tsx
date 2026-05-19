'use client'

import { useState } from 'react'
import { ShieldCheck, ShieldX, ChevronDown, ChevronUp, Database, Lock, Unlock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormProofDetails } from './FormProofDetails'
import { getFormSealConsistency } from '@/src/actions/audit'

type ProofCheck = {
    isValid: boolean
    proofArray: string[]
    root: string
    leafHash: string | null
    reason?: string
}

type SealedProofCheck = ProofCheck & {
    isSealed: boolean
    sealedAt: string | Date | null
    sealedLogCount: number | null
    rebuiltRootMatchesSeal: boolean
}

type SealConsistencyResult = {
    isValid: boolean
    reason: string | null
    previousSeal: {
        root_hash: string
        log_count: number
        created_at: string | Date
    } | null
    latestSeal: {
        root_hash: string
        log_count: number
        created_at: string | Date
    } | null
    currentLogCount?: number
    rebuiltPreviousRoot?: string
    rebuiltLatestRoot?: string
    previousRootMatches?: boolean
    latestRootMatches?: boolean
    countsAreMonotonic?: boolean
} | null

type IntegrityDebugState = {
    error?: string
    reconstructedState?: unknown
    currentState?: unknown
    approvalHashesValid?: boolean
    snapshotsMatchHistory?: boolean
    signatureEventsValid?: boolean
    signatoryRowsValid?: boolean
    authorizationSnapshotsValid?: boolean
    isSignedSnapshotValid?: boolean
    isAllocationAuditTrailValid?: boolean
    allocationAuditMismatchCount?: number
    allocationAuditLogsChecked?: number
    allocationAuditMismatches?: unknown[]
    isDataMatch?: boolean
}

function formatDebugValue(value: unknown) {
    if (value === undefined || value === null) return 'Not available'

    try {
        return JSON.stringify(value, null, 2)
    } catch {
        return String(value)
    }
}

function getDataMismatchReasons(debugState?: IntegrityDebugState | null) {
    if (!debugState) {
        return ['No detailed debug state was returned by the verifier.']
    }

    const reasons: string[] = []

    if (debugState.error) reasons.push(debugState.error)
    if (debugState.reconstructedState === null || debugState.reconstructedState === undefined) {
        reasons.push('The verifier could not reconstruct the form state from the audit trail.')
    }
    if (debugState.currentState === null || debugState.currentState === undefined) {
        reasons.push('The current form record could not be loaded from the database.')
    }
    if (debugState.snapshotsMatchHistory === false) {
        reasons.push('A submitted form snapshot does not match the state reconstructed from earlier audit events.')
    }
    if (debugState.approvalHashesValid === false) {
        reasons.push('A signed approval/rejection hash does not match the reconstructed form state.')
    }
    if (debugState.signatureEventsValid === false) {
        reasons.push('At least one signature event failed cryptographic verification.')
    }
    if (debugState.signatoryRowsValid === false) {
        reasons.push('A signed audit event does not match its stored signatory record.')
    }
    if (debugState.authorizationSnapshotsValid === false) {
        reasons.push('A signer authorization snapshot does not match the expected workflow role/access level.')
    }
    if (debugState.isSignedSnapshotValid === false) {
        reasons.push('The signed allocation snapshot does not match the current canonical allocation package.')
    }
    if (debugState.isAllocationAuditTrailValid === false) {
        reasons.push(`The allocation patch audit trail has ${debugState.allocationAuditMismatchCount ?? 'one or more'} mismatch(es).`)
    }

    const explicitChecksPassed =
        debugState.reconstructedState !== undefined &&
        debugState.reconstructedState !== null &&
        debugState.currentState !== undefined &&
        debugState.currentState !== null &&
        debugState.snapshotsMatchHistory !== false &&
        debugState.approvalHashesValid !== false &&
        debugState.signatureEventsValid !== false &&
        debugState.signatoryRowsValid !== false &&
        debugState.authorizationSnapshotsValid !== false

    if (reasons.length === 0 && explicitChecksPassed) {
        reasons.push('The reconstructed form state and current database state are different.')
    }

    return reasons
}

function isSignedFormEvent(eventType: string) {
    return eventType === 'SIGN' || eventType === 'APPROVE_FORM' || eventType === 'REJECT_FORM'
}

export type IntegrityResult = {
    isTimelineIntact: boolean
    isSealedRootValid: boolean
    timelineBrokenAt: string | null
    isDataMatch: boolean
    currentGlobalRoot: string | null
    lastSealedRoot: string | null
    totalEntityEvents: number
    formEventCount: number
    latestFormLogId?: string | null
    isSignedSnapshotValid?: boolean
    isAllocationAuditTrailValid?: boolean
    allocationAuditMismatchCount?: number
    allocationAuditLogsChecked?: number
    allocationAuditMismatches?: unknown[]
    currentProof?: ProofCheck | null
    sealedProof?: SealedProofCheck | null
    debugState?: IntegrityDebugState | null
    formLogs: Array<{
        id: string
        entity_id: string
        user_id: string
        event_type: string
        table_name: string | null
        record_id: string | null
        payload: Record<string, unknown> | null
        changed_at: string | Date
        prev_hash: string | null
        hash: string
        public_key_snapshot: string | null
        signature: string | null
        isSealed: boolean
        cryptographic_proof?: {
            isValid: boolean
            proofArray: string[]
            root: string
        } | null
    }>
}

export function FormIntegrityPanel({
    result,
    tableName,
    formId,
}: {
    result: IntegrityResult | null
    tableName?: string
    formId?: string
}) {
    const [showLogs, setShowLogs] = useState(false)
    const [showDataMismatchDetails, setShowDataMismatchDetails] = useState(false)
    const [sealConsistency, setSealConsistency] = useState<SealConsistencyResult>(null)
    const [sealConsistencyLoading, setSealConsistencyLoading] = useState(false)
    const [sealConsistencyError, setSealConsistencyError] = useState<string | null>(null)

    async function handleSealConsistencyCheck() {
        if (!tableName || !formId) return

        setSealConsistencyLoading(true)
        setSealConsistencyError(null)

        try {
            const consistencyResult = await getFormSealConsistency(tableName, formId)
            setSealConsistency(consistencyResult as SealConsistencyResult)
        } catch (error) {
            console.error('Failed to verify seal consistency', error)
            setSealConsistencyError('Failed to verify seal consistency. Please try again.')
        } finally {
            setSealConsistencyLoading(false)
        }
    }

    if (!result) {
        return (
            <div className="border border-border rounded-lg p-4 flex items-center gap-2 text-muted-foreground text-sm">
                <ShieldX className="h-4 w-4" />
                No audit data found for this form.
            </div>
        )
    }

    const hasSignedFormEvents = result.formLogs.some(
        (log) => isSignedFormEvent(log.event_type) || !!log.signature,
    )
    const isUnsignedDataMismatch =
        !hasSignedFormEvents &&
        !result.isDataMatch &&
        result.isTimelineIntact &&
        result.isSealedRootValid
    // A form is only fully valid if the chain is intact, the DB state matches, AND the daily seal matches
    const isAllocationAuditTrailValid = result.isAllocationAuditTrailValid !== false
    const isFullyValid =
        result.isTimelineIntact &&
        result.isDataMatch &&
        result.isSealedRootValid &&
        isAllocationAuditTrailValid
    const Icon = isFullyValid ? ShieldCheck : ShieldX
    const iconColor = isFullyValid
        ? 'text-emerald-600'
        : isUnsignedDataMismatch
          ? 'text-amber-600'
          : 'text-destructive'
    const headerBg = isFullyValid
        ? 'bg-emerald-50/50'
        : isUnsignedDataMismatch
          ? 'bg-amber-50/80'
          : 'bg-destructive/10'
    const headerTextColor = isFullyValid
        ? 'text-emerald-900'
        : isUnsignedDataMismatch
          ? 'text-amber-900'
          : 'text-destructive'
    const dataMismatchReasons = getDataMismatchReasons(result.debugState)
    const dataStateLabel = result.isDataMatch
        ? 'Matched'
        : hasSignedFormEvents
          ? 'Tampered'
          : 'Mismatched'
    const dataStateBadgeVariant =
        result.isDataMatch || isUnsignedDataMismatch ? 'outline' : 'destructive'
    const dataStateBadgeClass = result.isDataMatch
        ? 'border-emerald-600 text-emerald-700 bg-white'
        : isUnsignedDataMismatch
          ? 'border-amber-500 text-amber-800 bg-amber-50'
          : 'bg-white'
    const dataMismatchBoxClass = isUnsignedDataMismatch
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : 'bg-destructive/10 text-destructive border-destructive/20'
    const dataMismatchAccentClass = isUnsignedDataMismatch
        ? 'text-amber-800'
        : 'text-destructive'
    const dataMismatchDetailsClass = isUnsignedDataMismatch
        ? 'border-amber-200'
        : 'border-destructive/20'
    const failureTitle = hasSignedFormEvents
        ? 'CRITICAL: Integrity check failed'
        : 'Audit consistency check found a mismatch'

    return (
        <div className="border border-border rounded-lg overflow-hidden shadow-sm">
            {/* Header */}
            <div className={`flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 ${headerBg}`}>
                <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                    <div>
                        <p className={`font-medium text-sm ${headerTextColor}`}>
                            {isFullyValid ? 'Form data cryptographically secured' : failureTitle}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Verified against {result.totalEntityEvents} agency ledger events
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={result.isTimelineIntact ? 'default' : 'destructive'} className={result.isTimelineIntact ? 'bg-emerald-600 text-white' : ''}>
                        Ledger: {result.isTimelineIntact ? 'Intact' : 'Broken'}
                    </Badge>
                    <Badge variant={dataStateBadgeVariant} className={dataStateBadgeClass}>
                        Data State: {dataStateLabel}
                    </Badge>
                    <Badge variant={result.isSealedRootValid ? 'outline' : 'destructive'} className={result.isSealedRootValid ? 'border-emerald-600 text-emerald-700 bg-white' : 'bg-white'}>
                        Daily Seal: {result.isSealedRootValid ? 'Usable' : 'Unavailable'}
                    </Badge>
                    {result.isAllocationAuditTrailValid !== undefined ? (
                        <Badge
                            variant={result.isAllocationAuditTrailValid ? 'outline' : 'destructive'}
                            className={result.isAllocationAuditTrailValid ? 'border-emerald-600 text-emerald-700 bg-white' : 'bg-white'}
                        >
                            Allocation Trail: {result.isAllocationAuditTrailValid ? 'Matched' : 'Mismatch'}
                        </Badge>
                    ) : null}
                </div>
            </div>

            {/* Details & Errors */}
            <div className="p-4 space-y-4 text-sm bg-white">
                
                {/* Broken Chain Warning */}
                {!result.isTimelineIntact && result.timelineBrokenAt && (
                    <div className="bg-destructive/10 text-destructive rounded-md p-3 text-xs border border-destructive/20">
                        <strong>Chain broken at log ID:</strong> <span className="font-mono">{result.timelineBrokenAt}</span>
                    </div>
                )}
                
                {/* Data State Tampering Warning */}
                {!result.isDataMatch && result.isTimelineIntact && (
                    <div className={`rounded-md p-3 text-xs border ${dataMismatchBoxClass}`}>
                        <div className="flex gap-2">
                            <Database className="h-4 w-4 shrink-0 mt-0.5" />
                            <div className="flex-1 space-y-2">
                                {hasSignedFormEvents ? (
                                    <p><strong>Database Tampering Detected:</strong> The ledger history is intact, but the current database row does not match the digitally signed history.</p>
                                ) : (
                                    <p><strong>Audit State Mismatch:</strong> The ledger history is intact, but the current database row does not match the reconstructed audit history. No signed approval or rejection event has been recorded yet.</p>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowDataMismatchDetails((current) => !current)}
                                    className={`inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline ${dataMismatchAccentClass}`}
                                >
                                    {showDataMismatchDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    {showDataMismatchDetails ? 'Hide mismatch details' : 'Show mismatch details'}
                                </button>
                            </div>
                        </div>

                        {showDataMismatchDetails && (
                            <div className={`mt-3 space-y-3 rounded-md border bg-white p-3 text-slate-700 ${dataMismatchDetailsClass}`}>
                                <div>
                                    <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${dataMismatchAccentClass}`}>Detected Cause</p>
                                    <ul className="list-disc space-y-1 pl-4">
                                        {dataMismatchReasons.map((reason) => (
                                            <li key={reason}>{reason}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reconstructed From Audit Logs</p>
                                        <pre className="max-h-48 overflow-auto rounded border bg-slate-50 p-2 text-[10px] text-slate-600">
                                            {formatDebugValue(result.debugState?.reconstructedState)}
                                        </pre>
                                    </div>
                                    <div>
                                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Database State</p>
                                        <pre className="max-h-48 overflow-auto rounded border bg-slate-50 p-2 text-[10px] text-slate-600">
                                            {formatDebugValue(result.debugState?.currentState)}
                                        </pre>
                                    </div>
                                </div>

                                <div className="grid gap-2 md:grid-cols-2">
                                    {[
                                        ['Submitted snapshots match history', result.debugState?.snapshotsMatchHistory],
                                        ['Signed form hashes match reconstructed state', hasSignedFormEvents ? result.debugState?.approvalHashesValid : undefined],
                                        ['Signature events are cryptographically valid', hasSignedFormEvents ? result.debugState?.signatureEventsValid : undefined],
                                        ['Signatory records match audit events', hasSignedFormEvents ? result.debugState?.signatoryRowsValid : undefined],
                                        ['Authorization snapshots match workflow', hasSignedFormEvents ? result.debugState?.authorizationSnapshotsValid : undefined],
                                        ['Signed allocation snapshot matches current package', result.debugState?.isSignedSnapshotValid],
                                        ['Allocation patch audit trail matches current package', result.debugState?.isAllocationAuditTrailValid],
                                    ].map(([label, value]) => (
                                        <div key={String(label)} className="flex items-center justify-between gap-2 rounded border bg-slate-50 px-2 py-1.5">
                                            <span>{label}</span>
                                            <Badge variant={value === false ? 'destructive' : 'outline'} className={value === false ? '' : 'border-emerald-600 text-emerald-700 bg-white'}>
                                                {value === false ? 'Failed' : value === true ? 'Passed' : 'N/A'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {result.isAllocationAuditTrailValid === false ? (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                        <p>
                            <strong>Allocation Audit Trail Mismatch:</strong> Checked {result.allocationAuditLogsChecked ?? 0}{' '}
                            allocation audit log(s) and found {result.allocationAuditMismatchCount ?? 0} mismatch(es).
                        </p>
                        {result.allocationAuditMismatches?.length ? (
                            <pre className="mt-2 max-h-48 overflow-auto rounded border border-destructive/20 bg-white p-2 text-[10px] text-slate-700">
                                {formatDebugValue(result.allocationAuditMismatches)}
                            </pre>
                        ) : null}
                    </div>
                ) : null}

                {/* Rollback Attack Warning */}
                {!result.isSealedRootValid && (
                    <div className="bg-destructive/10 text-destructive rounded-md p-3 text-xs border border-destructive/20 flex gap-2">
                        <ShieldX className="h-4 w-4 shrink-0 mt-0.5" />
                        <p><strong>Seal Checkpoint Unavailable:</strong> The published seal can no longer anchor this timeline, which usually means newer logs were removed or the database was restored from an older checkpoint.</p>
                    </div>
                )}

                {/* Seal Metadata Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border/50">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                            Active Seal Reference
                        </p>
                        <p className="font-mono text-[10px] break-all text-slate-600 bg-slate-50 p-2 rounded border">
                            {result.currentGlobalRoot || 'Not computed during standard verification'}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                            Last Sealed Root (Published)
                        </p>
                        <p className="font-mono text-[10px] break-all text-slate-600 bg-slate-50 p-2 rounded border">
                            {result.lastSealedRoot || 'No nightly seal published yet'}
                        </p>
                    </div>
                </div>

                {/* Latest Form Log Merkle Proofs */}
                {result.latestFormLogId && (
                    <div className="space-y-3 border-b border-border/50 pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Latest Form Log Merkle Proofs</p>
                                <p className="text-xs text-muted-foreground">
                                    Proofs are generated for the most recent audit event for this form.
                                </p>
                            </div>
                            <Badge variant="secondary" className="font-mono text-[10px]">
                                {result.latestFormLogId}
                            </Badge>
                        </div>

                        {result.currentProof ? (
                            <div className="rounded-lg border p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Current Audit Tree</p>
                                    <Badge variant={result.currentProof.isValid ? 'default' : 'destructive'} className={result.currentProof.isValid ? 'bg-emerald-600 text-white' : ''}>
                                        {result.currentProof.isValid ? 'Included' : 'Invalid'}
                                    </Badge>
                                </div>
                                {result.currentProof.leafHash ? (
                                    <FormProofDetails
                                        isValid={result.currentProof.isValid}
                                        leafHash={result.currentProof.leafHash}
                                        root={result.currentProof.root}
                                        proof={result.currentProof.proofArray}
                                    />
                                ) : (
                                    <p className="text-xs text-muted-foreground">{result.currentProof.reason ?? 'Current proof unavailable.'}</p>
                                )}
                            </div>
                        ) : null}

                        {result.sealedProof ? (
                            <div className="rounded-lg border p-3">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Last Official Seal</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {result.sealedProof.isSealed
                                                ? `Covered by seal with ${result.sealedProof.sealedLogCount} logs.`
                                                : result.sealedProof.reason}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={result.sealedProof.isValid ? 'default' : result.sealedProof.isSealed ? 'destructive' : 'outline'}
                                        className={result.sealedProof.isValid ? 'bg-emerald-600 text-white' : ''}
                                    >
                                        {result.sealedProof.isValid ? 'Sealed' : result.sealedProof.isSealed ? 'Invalid' : 'Not Yet Sealed'}
                                    </Badge>
                                </div>
                                {result.sealedProof.leafHash && result.sealedProof.isSealed ? (
                                    <FormProofDetails
                                        isValid={result.sealedProof.isValid}
                                        leafHash={result.sealedProof.leafHash}
                                        root={result.sealedProof.root}
                                        proof={result.sealedProof.proofArray}
                                    />
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Advanced Seal Consistency Check */}
                {tableName && formId ? (
                    <div className="space-y-3 border-b border-border/50 pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Advanced Seal Consistency</p>
                                <p className="text-xs text-muted-foreground">
                                    Checks whether the latest seal preserves the previous sealed history.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleSealConsistencyCheck}
                                disabled={sealConsistencyLoading}
                            >
                                {sealConsistencyLoading ? 'Checking...' : 'Check Seal Consistency'}
                            </Button>
                        </div>

                        {sealConsistencyError && (
                            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                                {sealConsistencyError}
                            </div>
                        )}

                        {sealConsistency && (
                            <div className="rounded-lg border p-3 text-xs">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="font-bold uppercase tracking-wider text-slate-700">Seal Consistency Result</p>
                                    <Badge variant={sealConsistency.isValid ? 'default' : 'destructive'} className={sealConsistency.isValid ? 'bg-emerald-600 text-white' : ''}>
                                        {sealConsistency.isValid ? 'Consistent' : 'Needs Attention'}
                                    </Badge>
                                </div>
                                <p className={sealConsistency.isValid ? 'text-emerald-700' : 'text-destructive'}>
                                    {sealConsistency.isValid
                                        ? 'The latest seal is a valid continuation of the previous seal.'
                                        : sealConsistency.reason ?? 'Seal consistency could not be confirmed.'}
                                </p>
                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                    <div className="rounded bg-slate-50 p-2">
                                        <p className="font-semibold text-slate-700">Previous seal</p>
                                        <p>Logs: {sealConsistency.previousSeal?.log_count ?? 'N/A'}</p>
                                        <p className="font-mono break-all text-[10px]">{sealConsistency.previousSeal?.root_hash ?? 'N/A'}</p>
                                    </div>
                                    <div className="rounded bg-slate-50 p-2">
                                        <p className="font-semibold text-slate-700">Latest seal</p>
                                        <p>Logs: {sealConsistency.latestSeal?.log_count ?? 'N/A'}</p>
                                        <p className="font-mono break-all text-[10px]">{sealConsistency.latestSeal?.root_hash ?? 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Audit Log Timeline Toggle */}
                {result.formLogs.length > 0 && (
                    <div>
                        <button
                            onClick={() => setShowLogs(!showLogs)}
                            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                        >
                            {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {showLogs ? 'Hide form audit trail' : `View form audit trail (${result.formEventCount} events)`}
                        </button>

                        {/* Timeline List */}
                        {showLogs && (
                            <div className="mt-4 pl-2 space-y-4">
                                {result.formLogs.map((log, i) => (
                                    <div key={log.id} className="relative pl-6">
                                        <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-slate-300 border-2 border-white ring-1 ring-slate-200" />
                                        {i < result.formLogs.length - 1 && (
                                            <div className="absolute left-1 top-3.5 bottom-[-1rem] w-px bg-slate-200" />
                                        )}

                                        <div className="pb-2">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                                                    {log.event_type}
                                                </Badge>
                                                
                                                {/* SEAL STATUS BADGE */}
                                                <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${log.isSealed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                    {log.isSealed ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                                    {log.isSealed ? 'Sealed' : 'Pending Seal'}
                                                </div>

                                                <span className="text-xs text-muted-foreground ml-2">
                                                    by User ID: <span className="font-mono text-[10px] text-slate-600">{log.user_id}</span>
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-auto">
                                                    {new Date(log.changed_at).toLocaleString()}
                                                </span>
                                            </div>
                                            
                                            {log.cryptographic_proof && (
                                                <FormProofDetails 
                                                    isValid={log.cryptographic_proof.isValid}
                                                    leafHash={log.hash}
                                                    root={log.cryptographic_proof.root}
                                                    proof={log.cryptographic_proof.proofArray}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
