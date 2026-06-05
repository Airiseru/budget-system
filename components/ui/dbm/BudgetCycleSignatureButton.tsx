'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getUserKeys, verifySigningPin } from '@/src/actions/keys'
import {
    prepareBudgetCycleSignaturePayload,
    submitSignedBudgetCycleChange,
} from '@/src/actions/budgetSettings'
import { findLocalActiveSigningKey } from '@/src/lib/device-key-store'
import { signData } from '@/src/lib/crypto'
import type { BudgetCyclePhase } from '@/src/types/budget_settings'

type Props = {
    action: 'start_cycle' | 'change_phase'
    fiscalYear: number
    legalBasisRef?: string
    currentPhase?: BudgetCyclePhase
    disabled?: boolean
    className?: string
    children: React.ReactNode
    onSigned?: () => void
}

export default function BudgetCycleSignatureButton({
    action,
    fiscalYear,
    legalBasisRef,
    currentPhase,
    disabled = false,
    className,
    children,
    onSigned,
}: Props) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [pin, setPin] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSigning, setIsSigning] = useState(false)

    async function handleSign() {
        setError(null)

        if (pin.length !== 6) {
            setError('Please enter your 6-digit signing PIN.')
            return
        }

        setIsSigning(true)
        try {
            if (!(await verifySigningPin(pin))) {
                throw new Error('Incorrect PIN.')
            }

            const keys = await getUserKeys()
            const localSigningKey = await findLocalActiveSigningKey(keys)
            if (!localSigningKey) {
                throw new Error('No active digital signature key found for this device.')
            }

            const prepared = await prepareBudgetCycleSignaturePayload({
                action,
                fiscal_year: fiscalYear,
                legal_basis_ref: legalBasisRef,
                current_phase: currentPhase,
            })
            const output = await signData(prepared.signaturePayload, localSigningKey.privateKey, true)

            await submitSignedBudgetCycleChange({
                action,
                fiscal_year: fiscalYear,
                legal_basis_ref: legalBasisRef,
                current_phase: currentPhase,
                pin,
                key_id: localSigningKey.key.id,
                public_key_snapshot: localSigningKey.key.public_key,
                changed_at: prepared.changedAt,
                payload: prepared.payload,
                signature: output.signature,
                signature_payload: prepared.signaturePayload,
            })

            setPin('')
            setIsOpen(false)
            onSigned?.()
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sign budget cycle change.')
        } finally {
            setIsSigning(false)
        }
    }

    return (
        <>
            <Button
                type="button"
                disabled={disabled || isSigning}
                className={className}
                onClick={() => setIsOpen((open) => !open)}
                aria-expanded={isOpen}
            >
                {children}
            </Button>

            {isOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
                    <button
                        type="button"
                        aria-label="Close signature popup"
                        className="absolute inset-0 cursor-default"
                        onClick={() => {
                            if (isSigning) return
                            setIsOpen(false)
                            setPin('')
                            setError(null)
                        }}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="budget-cycle-signature-title"
                        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background p-5 text-foreground shadow-2xl space-y-4"
                    >
                        <div>
                            <p id="budget-cycle-signature-title" className="text-base font-semibold text-secondary-foreground">
                                DBM Approver Signature Required
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Enter your signing PIN to authorize this budget cycle change.
                            </p>
                        </div>
                        {error ? <p className="text-sm text-red-600">{error}</p> : null}
                        <input
                            type="password"
                            value={pin}
                            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full rounded border border-border bg-background px-3 py-2 font-mono tracking-widest"
                            placeholder="6-digit PIN"
                            maxLength={6}
                        />
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                disabled={pin.length !== 6 || isSigning}
                                onClick={handleSign}
                                className="flex-1 bg-accent-foreground text-white hover:bg-accent-foreground/90"
                            >
                                {isSigning ? 'Signing...' : 'Sign and Apply'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isSigning}
                                onClick={() => {
                                    setIsOpen(false)
                                    setPin('')
                                    setError(null)
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    )
}
