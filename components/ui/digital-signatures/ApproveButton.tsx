'use client'

import { useState } from 'react'
import { getPrivateKey } from '@/src/lib/device-key-store'
import { signFormData } from '@/src/lib/crypto'
import { verifyAndSubmitSignature, getUserKeys } from '@/src/actions/keys'
import { Button } from '@/components/ui/button'
import { PenLine, ShieldCheck, Eye, EyeOff } from 'lucide-react'

type Props = {
    formId: string
    formData: object
    userId: string
    onApproved?: () => void
}

type Step = 'idle' | 'pin' | 'approving' | 'approved'

export function ApproveButton({ formId, formData, userId, onApproved }: Props) {
    const [step, setStep] = useState<Step>('idle')
    const [pin, setPin] = useState('')
    const [showPin, setShowPin] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleApprove() {
        setError(null)

        if (pin.length !== 6) {
            setError('Please enter your 6-digit PIN.')
            return
        }

        setStep('approving')

        try {
            const privateKey = await getPrivateKey(userId)
            if (!privateKey) {
                setError('No digital signature key found. Please register this device first.')
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

            const signature = await signFormData(formData, privateKey)

            await verifyAndSubmitSignature(
                pin,
                formId,
                activeKey.id,
                activeKey.public_key,
                signature
            )

            setStep('approved')
            setPin('')
            onApproved?.()
        } catch (err: any) {
            setError(err.message ?? 'Failed to approved. Please try again.')
            setStep('pin')
            setPin('')
        }
    }

    if (step === 'approved') {
        return (
            <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-sm font-medium">Approved</span>
            </div>
        )
    }

    if (step === 'idle') {
        return (
            <Button onClick={() => setStep('pin')} className="gap-2">
                <PenLine className="h-4 w-4" />
                Sign Document
            </Button>
        )
    }

    return (
        <div className="border border-border rounded-lg p-4 space-y-3 max-w-sm">
            <div>
                <p className="font-medium text-sm">Enter your signing PIN</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Enter your 6-digit PIN to confirm your signature.
                </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="relative">
                <input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit PIN"
                    className="border px-3 py-2 w-full rounded bg-background font-mono pr-10 tracking-widest"
                    maxLength={6}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleApprove()}
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
                    onClick={handleApprove}
                    disabled={pin.length !== 6 || step === 'approving'}
                    className="flex-1"
                >
                    {step === 'approving' ? 'Approving...' : 'Confirm Approval'}
                </Button>
                <Button
                    variant="outline"
                    onClick={() => { setStep('idle'); setPin(''); setError(null) }}
                    disabled={step === 'approving'}
                >
                    Cancel
                </Button>
            </div>
        </div>
    )
}