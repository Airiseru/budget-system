'use client'

import { useState } from 'react'
import { ShieldCheck, ShieldX, ChevronDown, ChevronUp, Database, Lock, Unlock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { FormProofDetails } from './FormProofDetails'

type IntegrityResult = {
    isTimelineIntact: boolean
    isSealedRootValid: boolean
    timelineBrokenAt: string | null
    isDataMatch: boolean
    currentGlobalRoot: string
    lastSealedRoot: string | null
    totalEntityEvents: number
    formEventCount: number
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
        cryptographic_proof: {
            isValid: boolean
            proofArray: string[]
            root: string
        }
    }>
}

export function FormIntegrityPanel({ result }: { result: IntegrityResult | null }) {
    const [showLogs, setShowLogs] = useState(false)

    if (!result) {
        return (
            <div className="border border-border rounded-lg p-4 flex items-center gap-2 text-muted-foreground text-sm">
                <ShieldX className="h-4 w-4" />
                No audit data found for this form.
            </div>
        )
    }

    // A form is only fully valid if the chain is intact, the DB state matches, AND the daily seal matches
    const isFullyValid = result.isTimelineIntact && result.isDataMatch && result.isSealedRootValid
    const Icon = isFullyValid ? ShieldCheck : ShieldX
    const iconColor = isFullyValid ? 'text-emerald-600' : 'text-destructive'
    const headerBg = isFullyValid ? 'bg-emerald-50/50' : 'bg-destructive/10'

    return (
        <div className="border border-border rounded-lg overflow-hidden shadow-sm">
            {/* Header */}
            <div className={`flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 ${headerBg}`}>
                <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                    <div>
                        <p className={`font-medium text-sm ${isFullyValid ? 'text-emerald-900' : 'text-destructive'}`}>
                            {isFullyValid ? 'Form data cryptographically secured' : 'CRITICAL: Integrity check failed'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Verified against {result.totalEntityEvents} agency ledger events
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={result.isTimelineIntact ? 'default' : 'destructive'} className={result.isTimelineIntact ? 'bg-emerald-600' : ''}>
                        Ledger: {result.isTimelineIntact ? 'Intact' : 'Broken'}
                    </Badge>
                    <Badge variant={result.isDataMatch ? 'outline' : 'destructive'} className={result.isDataMatch ? 'border-emerald-600 text-emerald-700 bg-white' : 'bg-white'}>
                        Data State: {result.isDataMatch ? 'Matched' : 'Tampered'}
                    </Badge>
                    <Badge variant={result.isSealedRootValid ? 'outline' : 'destructive'} className={result.isSealedRootValid ? 'border-emerald-600 text-emerald-700 bg-white' : 'bg-white'}>
                        Daily Seal: {result.isSealedRootValid ? 'Verified' : 'Mismatched'}
                    </Badge>
                </div>
            </div>

            {/* Details & Errors */}
            <div className="p-4 space-y-4 text-sm bg-white">
                
                {/* 1. Broken Chain Warning */}
                {!result.isTimelineIntact && result.timelineBrokenAt && (
                    <div className="bg-destructive/10 text-destructive rounded-md p-3 text-xs border border-destructive/20">
                        <strong>Chain broken at log ID:</strong> <span className="font-mono">{result.timelineBrokenAt}</span>
                    </div>
                )}
                
                {/* 2. Data State Tampering Warning */}
                {!result.isDataMatch && result.isTimelineIntact && (
                    <div className="bg-destructive/10 text-destructive rounded-md p-3 text-xs border border-destructive/20 flex gap-2">
                        <Database className="h-4 w-4 shrink-0 mt-0.5" />
                        <p><strong>Database Tampering Detected:</strong> The ledger history is intact, but the current database row does not match the digitally signed history.</p>
                    </div>
                )}

                {/* 3. Rollback Attack Warning */}
                {!result.isSealedRootValid && (
                    <div className="bg-destructive/10 text-destructive rounded-md p-3 text-xs border border-destructive/20 flex gap-2">
                        <ShieldX className="h-4 w-4 shrink-0 mt-0.5" />
                        <p><strong>Rollback Detected:</strong> The database timeline appears intact, but the math does not match the officially published nightly seal. The database may have been restored to an older backup to hide recent actions.</p>
                    </div>
                )}

                {/* Merkle Roots Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border/50">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
                            Current Global Root
                        </p>
                        <p className="font-mono text-[10px] break-all text-slate-600 bg-slate-50 p-2 rounded border">
                            {result.currentGlobalRoot}
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
                                            
                                            <FormProofDetails 
                                                isValid={log.cryptographic_proof.isValid}
                                                leafHash={log.hash}
                                                root={log.cryptographic_proof.root}
                                                proof={log.cryptographic_proof.proofArray}
                                            />
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