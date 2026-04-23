'use client'

import { useState } from 'react'
import { setSigningPin } from '@/src/actions/keys'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'

export function SetPinForm({ hasPin }: { hasPin: boolean }) {
    const [pin, setPin] = useState('')
    const [confirmPin, setConfirmPin] = useState('')
    const [showPin, setShowPin] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)

        if (pin.length !== 6) {
            setError('PIN must be exactly 6 digits.')
            return
        }
        if (pin !== confirmPin) {
            setError('PINs do not match.')
            return
        }

        setIsLoading(true)
        try {
            await setSigningPin(pin)
            setSuccess(true)
            setPin('')
            setConfirmPin('')
        } catch (err: any) {
            setError(err.message ?? 'Failed to set PIN. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    if (success) {
        return (
            <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-sm font-medium">
                    Signing PIN {hasPin ? 'updated' : 'set'} successfully.
                </p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-full">
            <div>
                <h3 className="font-semibold">{hasPin ? 'Update' : 'Set'} Signing PIN</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                    This 6-digit PIN is required every time you sign a document.
                    Keep it separate from your login password.
                </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="space-y-2">
                <label htmlFor='pin' className="text-sm font-medium">PIN</label>
                <div className="relative">
                    <input
                        id='pin'
                        type={showPin ? 'text' : 'password'}
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6 digits"
                        className="border px-3 py-2 w-full rounded bg-background font-mono pr-10 tracking-widest my-1"
                        maxLength={6}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPin(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor='confirm-pin' className="text-sm font-medium">Confirm PIN</label>
                <input
                    id='confirm-pin'
                    type={showPin ? 'text' : 'password'}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 digits"
                    className="border px-3 py-2 w-full rounded bg-background font-mono tracking-widest my-1"
                    maxLength={6}
                />
            </div>
            <button
                type='submit'
                disabled={isLoading || !pin || !confirmPin || pin.length !== 6 || confirmPin.length !== 6}
                className="w-full bg-accent-foreground text-white disabled:opacity-50 px-4 py-2 rounded"
            >
                {isLoading ? 'Saving...' : `${hasPin ? 'Update' : 'Set'} Signing PIN`}
            </button>
        </form>
    )
}