'use client'

import { useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getFormIntegrity } from '@/src/actions/audit'
import { FormIntegrityPanel, type IntegrityResult } from './FormIntegrityPanel'

type VerifyIntegrityDialogProps = {
    tableName: string
    formId: string
}

export default function VerifyIntegrityDialog({
    tableName,
    formId,
}: VerifyIntegrityDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<IntegrityResult | null>(null)

    async function handleOpen() {
        setOpen(true)
        setLoading(true)
        setError(null)

        try {
            const integrityResult = await getFormIntegrity(tableName, formId)
            setResult(integrityResult as IntegrityResult | null)
        } catch (caughtError) {
            console.error('Failed to verify form integrity', caughtError)
            setError('Failed to verify form integrity. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <Button type="button" variant="outline" onClick={handleOpen} className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Verify Integrity
            </Button>

            {open ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                            <div>
                                <h2 className="text-xl font-semibold text-secondary-foreground">Form Integrity Verification</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Verify the integrity of a form by running the audit ledger verification.
                                </p>
                            </div>
                            <Button type="button" variant="outline" size="icon-sm" onClick={() => setOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="overflow-y-auto px-5 py-5">
                            {loading ? (
                                <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                                    Running integrity verification...
                                </div>
                            ) : error ? (
                                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-4 text-sm text-destructive">
                                    {error}
                                </div>
                            ) : (
                                <FormIntegrityPanel
                                    result={result}
                                    tableName={tableName}
                                    formId={formId}
                                />
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    )
}
