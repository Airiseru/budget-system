'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { findLocalActiveSigningKey } from '@/src/lib/device-key-store'
import { signData } from '@/src/lib/crypto'
import { getUserKeys, verifySigningPin } from '@/src/actions/keys'
import {
    prepareBulkProposalRejectPayloads,
    submitSignedBulkProposalReject,
} from '@/src/actions/dbmProposalReview'

type ScopeType = 'department' | 'agency' | 'operating_unit'
type Step = 'confirm' | 'signing' | 'done'

type Props = {
    fiscalYear: number
    scopeType: ScopeType
    scopeId: string
    scopeName: string
    label: string
}

export default function SignedBulkRejectButton({
    fiscalYear,
    scopeType,
    scopeId,
    scopeName,
    label,
}: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<Step>('confirm')
    const [remarks, setRemarks] = useState('')
    const [pin, setPin] = useState('')
    const [confirmationText, setConfirmationText] = useState('')
    const [showPin, setShowPin] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const confirmationMatches = confirmationText.trim() === scopeName.trim()

    const reset = () => {
        setStep('confirm')
        setRemarks('')
        setPin('')
        setConfirmationText('')
        setShowPin(false)
        setError(null)
    }

    const closeDialog = () => {
        if (step === 'signing') return
        setOpen(false)
        reset()
    }

    async function handleSignedBulkReject() {
        setError(null)

        if (!remarks.trim()) {
            setError('Remarks are required for bulk rejection.')
            return
        }

        if (pin.length !== 6) {
            setError('Please enter your 6-digit PIN.')
            return
        }

        if (!confirmationMatches) {
            setError(`Type "${scopeName}" to confirm this bulk rejection.`)
            return
        }

        setStep('signing')

        try {
            if (!await verifySigningPin(pin)) {
                setError('Incorrect PIN')
                setStep('confirm')
                setPin('')
                return
            }

            const keys = await getUserKeys()
            const activeKeys = keys.filter((key) => key.status === 'active')
            const localSigningKey = await findLocalActiveSigningKey(keys)

            if (activeKeys.length === 0) {
                throw new Error('No active digital signature key. Please register or renew your device key.')
            }

            if (!localSigningKey) {
                throw new Error('No digital signature key found for this registered device. Please use the correct device or register this device.')
            }

            const preparedPayloads = await prepareBulkProposalRejectPayloads({
                fiscalYear,
                scopeType,
                scopeId,
                remarks: remarks.trim(),
            })

            const signatures = await Promise.all(
                preparedPayloads.map(async (prepared) => {
                    const output = await signData(prepared.signaturePayload, localSigningKey.privateKey, true)

                    return {
                        proposalId: prepared.proposalId,
                        payload: prepared.payload,
                        changedAt: prepared.changedAt,
                        signaturePayload: prepared.signaturePayload,
                        signature: output.signature,
                    }
                })
            )

            const result = await submitSignedBulkProposalReject({
                pin,
                keyId: localSigningKey.key.id,
                fiscalYear,
                scopeType,
                scopeId,
                signatures,
            })

            setStep('done')
            setRemarks('')
            setPin('')
            setConfirmationText('')
            router.refresh()

            window.setTimeout(() => {
                setOpen(false)
                setStep('confirm')
            }, 1800)

            if (result.rejectedCount === 0) {
                setError('No proposals were rejected.')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to complete signed bulk rejection.')
            setStep('confirm')
            setPin('')
        }
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                onClick={() => {
                    reset()
                    setOpen(true)
                }}
                className="rounded border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
                {label}
            </Button>

            {open ? (
                <>
                    <div className="fixed inset-0 z-40 bg-black/35" onClick={closeDialog} />
                    <div className="fixed left-1/2 top-1/2 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-red-200 bg-background shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-red-100 bg-red-50 px-5 py-4">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-wide text-red-700">
                                    Signed bulk rejection
                                </p>
                                <h2 className="mt-1 text-xl font-semibold text-red-950">
                                    Reject pending proposals for {scopeName}
                                </h2>
                                <p className="mt-1 text-sm text-red-700">
                                    One PIN will sign a separate rejection event for every pending proposal in this scope.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={closeDialog}
                                disabled={step === 'signing'}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
                            {step === 'done' ? (
                                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-700">
                                    Bulk rejection signed and applied.
                                </div>
                            ) : (
                                <>
                                    {error ? (
                                        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                            {error}
                                        </p>
                                    ) : null}

                                    <label className="mb-3 block space-y-1" htmlFor="remarks">
                                        <span className="text-sm font-semibold text-foreground">
                                            DBM rejection remarks
                                        </span>
                                        <textarea
                                            id="remarks"
                                            name="remarks"
                                            value={remarks}
                                            onChange={(event) => setRemarks(event.target.value)}
                                            placeholder="Explain why these pending proposals are being rejected"
                                            className="min-h-28 w-full resize-y rounded border border-red-200 bg-white px-3 py-2 text-sm mt-1"
                                            disabled={step === 'signing'}
                                        />
                                    </label>

                                    <label className="mb-3 block space-y-1" htmlFor='scope_name'>
                                        <span className="text-sm font-semibold text-foreground">
                                            Type the scope name to confirm
                                        </span>
                                        <input
                                            id='scope_name'
                                            name='scope_name'
                                            value={confirmationText}
                                            onChange={(event) => setConfirmationText(event.target.value)}
                                            placeholder={scopeName}
                                            className="w-full rounded border border-red-200 bg-white px-3 py-2 text-sm mt-1"
                                            disabled={step === 'signing'}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            Required confirmation: <span className="font-semibold text-foreground">{scopeName}</span>
                                        </span>
                                    </label>

                                    <label className="mb-1 block space-y-1" htmlFor="pin">
                                        <span className="text-sm font-semibold text-foreground">
                                            Digital signature PIN
                                        </span>
                                        <div className="relative mt-1">
                                            <input
                                                id="pin"
                                                name="pin"
                                                type={showPin ? 'text' : 'password'}
                                                value={pin}
                                                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                                placeholder="6-digit PIN"
                                                className="w-full rounded border border-red-200 bg-white px-3 py-2 pr-10 font-mono tracking-widest"
                                                maxLength={6}
                                                disabled={step === 'signing'}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPin((current) => !current)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                disabled={step === 'signing'}
                                            >
                                                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </label>
                                </>
                            )}
                        </div>

                        {step !== 'done' ? (
                            <div className="flex flex-col-reverse gap-2 border-t border-red-100 px-5 py-4 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeDialog}
                                    disabled={step === 'signing'}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSignedBulkReject}
                                    disabled={
                                        step === 'signing' ||
                                        pin.length !== 6 ||
                                        !remarks.trim() ||
                                        !confirmationMatches
                                    }
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    {step === 'signing' ? 'Signing...' : 'Sign and reject scope'}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </>
            ) : null}
        </>
    )
}
