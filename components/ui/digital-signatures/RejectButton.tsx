'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPrivateKey } from '@/src/lib/device-key-store'
import { signData } from '@/src/lib/crypto'
import { sha256, buildSignaturePayload } from '@/src/lib/audit-hash'
import { verifyAndRejectSignature, getUserKeys, verifySigningPin } from '@/src/actions/keys'
import { FormSignaturePayload } from '@/src/types/audit'
import { canonicalStringify } from '@/src/lib/canonical'
import { cleanDataBasedOnTable } from '@/src/lib/validations'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, RotateCcw } from 'lucide-react'

type Props = {
    formId: string
    tableName: string
    formData: object
    userId: string
    entityId: string
    signatoryRole: string
    fromAuthStatus?: string
    toAuthStatus?: string
}

type Step = 'idle' | 'pin' | 'rejecting' | 'rejected'

export function RejectButton({ formId, tableName, formData, userId, entityId, signatoryRole, fromAuthStatus, toAuthStatus }: Props) {
    const router = useRouter()
    const [step, setStep] = useState<Step>('idle')
    const [pin, setPin] = useState('')
    const [remarks, setRemarks] = useState('')
    const [showPin, setShowPin] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleReject() {
        setError(null)

        if (!remarks.trim()) {
            setError('Please enter rejection remarks.')
            return
        }

        if (pin.length !== 6) {
            setError('Please enter your 6-digit PIN.')
            return
        }

        setStep('rejecting')

        try {
            const privateKey = await getPrivateKey(userId)
            if (!privateKey) {
                setError('No digital signature key found. Please register this device first.')
                setStep('pin')
                return
            }

            if (!await verifySigningPin(pin)) {
                setError('Incorrect PIN')
                setStep('pin')
                return
            }

            const keys = await getUserKeys()
            const activeKey = keys.find(k => k.status === 'active')
            if (!activeKey) {
                setError('No active digital signature key. Please register or renew your device key.')
                setStep('pin')
                return
            }

            const date = new Date()
            const cleanFormData = cleanDataBasedOnTable(tableName, formData)

            const payload: FormSignaturePayload = {
                from_status: fromAuthStatus ?? signatoryRole,
                to_status: toAuthStatus ?? 'draft',
                form_state_hash: sha256(canonicalStringify(cleanFormData)),
                remarks: remarks.trim(),
            }

            const signaturePayload = buildSignaturePayload({
                entity_id: entityId,
                user_id: userId,
                event_type: 'REJECT_FORM',
                table_name: tableName,
                record_id: formId,
                payload: payload,
                changed_at: date,
            })

            const output = await signData(signaturePayload, privateKey, true)

            await verifyAndRejectSignature(
                pin,
                tableName,
                formId,
                payload,
                activeKey.id,
                activeKey.public_key,
                date,
                signatoryRole,
                output.signature,
                signaturePayload as string
            )

            setStep('rejected')
            setPin('')
            setRemarks('')
            router.refresh()
        } catch (err: any) {
            setError(err.message ?? 'Failed to reject. Please try again.')
            setStep('pin')
            setPin('')
        }
    }

    if (step === 'rejected') {
        return (
            <div className="text-sm font-medium text-destructive">
                Form rejected
            </div>
        )
    }

    if (step === 'idle') {
        return (
            <Button variant="outline" onClick={() => setStep('pin')} className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                <RotateCcw className="h-4 w-4" />
                Reject
            </Button>
        )
    }

    return (
        <div className="border border-border rounded-lg p-4 space-y-3 max-w-sm">
            <div>
                <p className="font-medium text-sm">Reject with remarks</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Provide remarks and enter your PIN to reject this form.
                </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Enter rejection remarks"
                className="border px-3 py-2 w-full rounded bg-background text-sm min-h-24 resize-y"
            />

            <div className="relative">
                <input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit PIN"
                    className="border px-3 py-2 w-full rounded bg-background font-mono pr-10 tracking-widest"
                    maxLength={6}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleReject()}
                />
                <button
                    type="button"
                    onClick={() => setShowPin(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>

            <div className="flex gap-2">
                <Button
                    onClick={handleReject}
                    disabled={!remarks.trim() || pin.length !== 6 || step === 'rejecting'}
                    className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white"
                >
                    {step === 'rejecting' ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
                <Button
                    variant="outline"
                    onClick={() => { setStep('idle'); setPin(''); setRemarks(''); setError(null) }}
                    disabled={step === 'rejecting'}
                >
                    Cancel
                </Button>
            </div>
        </div>
    )
}
