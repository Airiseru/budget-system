'use client'

import { useEffect, useState } from 'react'
import { generateKeyPair } from '@/src/lib/crypto'
import { hasPrivateKey, storePrivateKey, getDeviceName } from '@/src/lib/device-key-store'
import { registerDeviceKey } from '@/src/actions/keys'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { KeyRound, X, ChevronDown, ChevronUp } from 'lucide-react'

type ExpirationOptions = {
    [key in 30 | 60 | 90 | 365 | 730]: string;
}

const expirationOptions: ExpirationOptions = {
    30: '30 days',
    60: '60 days',
    90: '90 days',
    365: '1 year',
    730: '2 years',
}

export function DeviceKeyBanner({ userId }: { userId: string }) {
    const [needsKey, setNeedsKey] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const [dismissed, setDismissed] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [deviceName, setDeviceName] = useState('')
    const [expiresInDays, setExpiresInDays] = useState(365)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleExpirationDateChange = (value: number | null) => {
        setExpiresInDays(value ? Number(value) : 365)
    }

    useEffect(() => {
        hasPrivateKey(userId).then(has => {
            setNeedsKey(!has)
            if (!has) setExpanded(true)
        })
        setDeviceName(getDeviceName())
    }, [userId])

    async function handleRegister() {
        if (!deviceName.trim()) {
            setError('Please enter a device name.')
            return
        }

        setIsRegistering(true)
        setError(null)

        try {
            const { publicKeyBase64, privateKey } = await generateKeyPair()
            await storePrivateKey(userId, privateKey)
            await registerDeviceKey(publicKeyBase64, deviceName, expiresInDays)
            setSuccess(true)
            setNeedsKey(false)
        } catch (err) {
            setError('Failed to register device. Please try again.')
        } finally {
            setIsRegistering(false)
        }
    }

    if (!needsKey || dismissed) return null

    if (success) {
        return (
            <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center justify-between">
                <p className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                    Device registered successfully. You can now approve documents.
                </p>
                <button onClick={() => setDismissed(true)}>
                    <X className="h-4 w-4 text-emerald-600" />
                </button>
            </div>
        )
    }

    return (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 space-y-3">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <KeyRound className="h-5 w-5 text-yellow-600 shrink-0" />
                    <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">
                            This device is not registered for digital signatures.
                        </p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                            Register this device to sign documents and form submissions.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="text-yellow-600 hover:text-yellow-800"
                    >
                        {expanded
                            ? <ChevronUp className="h-4 w-4" />
                            : <ChevronDown className="h-4 w-4" />
                        }
                    </button>
                    <button
                        onClick={() => setDismissed(true)}
                        className="text-yellow-600 hover:text-yellow-800"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="space-y-3 pt-2 ml-9">
                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <div className="flex gap-4 items-center">
                        <label htmlFor='device-name' className="text-xs font-medium text-yellow-800 dark:text-yellow-200 w-24">
                            Device Name
                        </label>
                        <input
                            id='device-name'
                            value={deviceName}
                            onChange={e => setDeviceName(e.target.value)}
                            placeholder="e.g. Office Desktop"
                            className="border px-3 py-1.5 rounded text-sm bg-background w-full max-w-xs"
                        />
                    </div>

                    <div className="flex gap-4 items-center">
                        <label htmlFor='expires-in-days' className="text-xs font-medium text-yellow-800 dark:text-yellow-200 w-24">
                            Key Expiration
                        </label>
                        <input name="expires-in-days" type="hidden" value={expiresInDays} required />
                        <Select
                            value={expiresInDays}
                            onValueChange={handleExpirationDateChange}
                        >
                            <SelectTrigger className="border-border px-3 py-1.5 rounded text-sm bg-background w-full max-w-xs">
                                <SelectValue placeholder="1 year">
                                    {expiresInDays ? expirationOptions[expiresInDays as keyof typeof expirationOptions] : '1 year'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={90}>90 days</SelectItem>
                                <SelectItem value={180}>180 days</SelectItem>
                                <SelectItem value={365}>1 year</SelectItem>
                                <SelectItem value={730}>2 years</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="pt-2">
                        <Button
                            onClick={handleRegister}
                            disabled={isRegistering || !deviceName.trim()}
                            size="sm"
                            className="bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 text-white p-4"
                        >
                            {isRegistering ? 'Registering...' : 'Register This Device'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}