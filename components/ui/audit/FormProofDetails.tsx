'use client'

import { useState } from 'react'
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ProofDetailsProps = {
    isValid: boolean
    leafHash: string
    root: string
    proof: string[]
}

export function FormProofDetails({ isValid, leafHash, root, proof }: ProofDetailsProps) {
    const [expanded, setExpanded] = useState(false)

    if (!isValid) {
        return (
            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded flex items-center gap-2 text-xs text-destructive font-medium">
                <ShieldAlert className="h-4 w-4" />
                Cryptographic signature failed verification.
            </div>
        )
    }

    return (
        <div className="mt-2 border border-emerald-200 rounded-md overflow-hidden bg-white">
            {/* Standard User View */}
            <div className="px-3 py-2 bg-emerald-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700 font-medium text-xs">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Cryptographically Verified</span>
                </div>
                <button 
                    onClick={() => setExpanded(!expanded)}
                    className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                >
                    {expanded ? 'Hide Math' : 'View Math'}
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
            </div>

            {/* Auditor View (The Math) */}
            {expanded && (
                <div className="p-3 border-t border-emerald-100 text-xs font-mono break-all space-y-3 bg-slate-50/50">
                    <div>
                        <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[9px] mb-1">Leaf Hash (This Entry)</p>
                        <p className="bg-white p-1.5 rounded border text-slate-700">{leafHash}</p>
                    </div>

                    <div>
                        <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[9px] mb-1">Merkle Proof (Path to Root)</p>
                        <div className="bg-white p-1.5 rounded border space-y-1 max-h-32 overflow-y-auto">
                            {proof.length === 0 ? (
                                <span className="text-slate-400">Root node (no siblings)</span>
                            ) : (
                                proof.map((hash, index) => (
                                    <div key={index} className="flex gap-2 text-slate-600">
                                        <span className="text-slate-400 select-none">[{index}]</span>
                                        <span>{hash}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="text-muted-foreground font-semibold uppercase tracking-wider text-[9px] mb-1">Global Merkle Root</p>
                        <p className="bg-emerald-100/50 p-1.5 rounded border border-emerald-200 text-emerald-900 font-bold">
                            {root}
                        </p>
                    </div>

                    <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full text-xs h-7 mt-1 text-slate-600"
                        onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify({ leafHash, proof, root }, null, 2))
                        }}
                    >
                        <Copy className="h-3 w-3 mr-2" />
                        Copy JSON Proof
                    </Button>
                </div>
            )}
        </div>
    )
}