'use client'

import { useState } from 'react'
import { revokeDeviceKey } from '@/src/actions/keys'
import { removePrivateKey } from '@/src/lib/device-key-store'
import { UserKey } from '@/src/types/keys'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Monitor, ShieldOff } from 'lucide-react'

export function DeviceKeysSettings({ keys, userId }: { keys: UserKey[], userId: string }) {
    const [revoking, setRevoking] = useState<string | null>(null)

    async function handleRevoke(keyId: string) {
        if (!confirm('Revoke this key? This device will no longer be able to sign documents.')) return
        setRevoking(keyId)
        try {
            await revokeDeviceKey(keyId)
            await removePrivateKey(userId)
            window.location.reload()
        } catch (err) {
            console.error('Failed to revoke key', err)
        } finally {
            setRevoking(null)
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold">Registered Devices</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Each device you use to sign documents has its own key.
                    Revoke keys for devices you no longer use.
                </p>
            </div>

            {keys.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
                    No signing keys registered.
                </div>
            ) : (
                <div className="space-y-2">
                    {keys.map(key => (
                        <div
                            key={key.id}
                            className="border border-border rounded-lg p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-4">
                                <Monitor className="h-5 w-5 text-muted-foreground shrink-0" />
                                <div>
                                    <p className="font-medium text-sm mb-1">{key.device_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Added {new Date(key.created_at).toLocaleDateString()}
                                        {key.expires_at && (
                                            <> · Expires {new Date(key.expires_at).toLocaleDateString()}</>
                                        )}
                                        {key.revoked_at && (
                                            <> · Revoked {new Date(key.revoked_at).toLocaleDateString()}</>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Badge variant={
                                    key.status === 'active' ? 'default' :
                                    key.status === 'expired' ? 'secondary' : 'destructive'
                                }>
                                    {key.status.charAt(0).toUpperCase() + key.status.slice(1)}
                                </Badge>
                                {key.status === 'active' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRevoke(key.id)}
                                        disabled={revoking === key.id}
                                        className="text-destructive hover:text-destructive gap-1"
                                    >
                                        <ShieldOff className="h-4 w-4" />
                                        {revoking === key.id ? 'Revoking...' : 'Revoke'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}