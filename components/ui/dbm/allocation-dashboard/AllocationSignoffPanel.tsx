'use client'

import { useState } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { SignButton } from '@/components/ui/digital-signatures/SignButton'
import type { BudgetCyclePhase } from '@/src/types/budget_settings'
import type { SignoffData } from './shared'
import { formatDateTime } from './shared'

type Props = {
    signoff: SignoffData | null
    currentPhase: BudgetCyclePhase | null
    signingBlocked: boolean
    signingBlockedMessage?: string
    onApproved: () => void
}

export default function AllocationSignoffPanel({
    signoff,
    currentPhase,
    signingBlocked,
    signingBlockedMessage,
    onApproved,
}: Props) {
    const [certified, setCertified] = useState(false)
    const [open, setOpen] = useState(false)

    if (!signoff) return null

    const title = currentPhase === 'presidential_approval' ? 'Finalize NEP' : 'Finalize GAA'
    const requiresValidity = currentPhase === 'legislative_deliberation'
    const missingValidity = requiresValidity && signoff.missingValidityCount > 0
    const disabled = !certified || missingValidity || signingBlocked
    const disabledMessage = !certified
        ? 'Please certify that these allocations are final and authorized before signing.'
        : missingValidity
            ? 'All allocations must have both valid-from and valid-until dates before sign-off.'
        : signingBlockedMessage

    return (
        <section className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/20"
            >
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-secondary-foreground">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        A DBM approver signature locks this stage and advances the budget cycle automatically.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                        {signoff.codename}
                    </div>
                    <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                </div>
            </button>

            {open ? (
                <div className="border-t border-border p-5 space-y-4">
                    {signoff.signatories.length > 0 ? (
                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Current signatories
                            </p>
                            <div className="space-y-1.5 mt-2">
                                {signoff.signatories.map((signatory) => (
                                    <div key={signatory.id} className="flex items-center justify-between gap-3 text-sm">
                                        <span>{signatory.user_name}</span>
                                        <span className="text-muted-foreground">
                                            {formatDateTime(signatory.created_at)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <label className="flex items-center gap-3 rounded-lg bg-muted/40 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={certified}
                            onChange={(event) => setCertified(event.target.checked)}
                            className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-secondary-foreground">
                            I certify that these allocations are final and authorized.
                        </span>
                    </label>

                    <div className="mt-4">
                        {missingValidity ? (
                            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {signoff.missingValidityCount} allocation{signoff.missingValidityCount === 1 ? '' : 's'} still need a complete validity period before this stage can be signed.
                            </div>
                        ) : null}
                        {signoff.authStatus === 'approved' ? (
                            <div className="inline-flex items-center gap-2 text-emerald-700 font-medium">
                                <ShieldCheck className="h-4 w-4" />
                                Stage already signed and approved.
                            </div>
                        ) : signoff.alreadySigned ? (
                            <div className="inline-flex items-center gap-2 text-emerald-700 font-medium">
                                <ShieldCheck className="h-4 w-4" />
                                You have already signed this stage.
                            </div>
                        ) : signoff.userCanSign ? (
                            <SignButton
                                entityId={signoff.entityId}
                                tableName="budget_allocations"
                                formId={signoff.formId}
                                formData={signoff.formData}
                                userId={signoff.userId}
                                signatoryRole={signoff.signatoryRole}
                                fromAuthStatus={signoff.authStatus}
                                toAuthStatus="approved"
                                onApproved={onApproved}
                                disabled={disabled}
                                disabledMessage={disabledMessage}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground italic">
                                Only DBM approvers can sign this stage.
                            </p>
                        )}
                    </div>
                </div>
            ) : null}
        </section>
    )
}
