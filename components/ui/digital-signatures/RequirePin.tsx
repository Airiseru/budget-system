'use client'

import { useState } from 'react'
import { getPrivateKey } from '@/src/lib/device-key-store'
import { verifySigningPin, getUserKeys } from '@/src/actions/keys'
import { AuditEventType } from '@/src/types/audit'
import { signData } from '@/src/lib/crypto'
import { buildSignaturePayload } from '@/src/lib/audit-hash'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

// Define the shape of the data we want to sign, minus the context
export type ActionPayload = {
    event_type: AuditEventType
    table_name: string | null
    record_id: string | null
    payload: Record<string, unknown> | string | null
}

type Props = {
    userId: string
    entityId: string
    actionPayload: ActionPayload
    buttonLabel?: string
    onSuccess: (data: { signature: string; timestamp: Date; signingPayload: string, event_type: AuditEventType, table_name: string | null, record_id: string | null }) => Promise<void>
    onCancel: () => void
}

export function RequirePin({ 
    userId, 
    entityId,
    actionPayload, 
    buttonLabel = 'Confirm Signature',
    onSuccess, 
    onCancel 
}: Props) {
    const [showPin, setShowPin] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [pin, setPin] = useState('')
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e?: React.SyntheticEvent<HTMLFormElement>) {
        if (e) e.preventDefault()
        setError(null)

        if (pin.length !== 6) {
            setError('PIN must be exactly 6 digits.')
            return
        }

        setIsVerifying(true)

        try {
            const privateKey = await getPrivateKey(userId)
            if (!privateKey) throw new Error('No digital signature key found. Please register this device first.')

            const keys = await getUserKeys()
            const activeKey = keys.find(k => k.status === 'active')
            if (!activeKey) throw new Error('No active digital signature key. Please register or renew your device key.')
    
            if (!await verifySigningPin(pin)) throw new Error('Incorrect PIN')

            // Create a timestamp
            const date = new Date()
            
            // Build the signature payload
            const signaturePayload = buildSignaturePayload({
                entity_id: entityId,
                user_id: userId,
                changed_at: date,
                ...actionPayload
            })

            // Generate the signature
            const output = await signData(signaturePayload, privateKey)
            const signature = output.signature

            // Pass the locked data back to the parent component to handle the server action
            await onSuccess({ 
                signature, 
                timestamp: date,
                signingPayload: signaturePayload,
                event_type: actionPayload.event_type,
                table_name: actionPayload.table_name,
                record_id: actionPayload.record_id
            })

        } catch (err: any) {
            setError(err.message ?? 'Failed to verify PIN. Please try again.')
            setPin('')
            setIsVerifying(false)
        }
    }

    return (
        <div className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            
            <div className="relative">
                <input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit PIN"
                    className="border px-3 py-2 w-full rounded bg-background font-mono pr-10 tracking-widest"
                    maxLength={6}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                <button
                    type="button"
                    onClick={() => setShowPin(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
            </div>

            <div className="flex gap-2">
                <Button
                    onClick={() => handleSubmit()}
                    disabled={pin.length !== 6 || isVerifying}
                    className="flex-1 bg-accent-foreground text-white"
                >
                    {isVerifying ? 'Signing...' : buttonLabel}
                </Button>
                <Button
                    variant="outline"
                    onClick={() => { setPin(''); setError(null); onCancel(); }}
                    disabled={isVerifying}
                >
                    Cancel
                </Button>
            </div>
        </div>
    )
}