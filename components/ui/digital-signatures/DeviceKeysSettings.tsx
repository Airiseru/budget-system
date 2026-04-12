'use client'

import { useState } from 'react'
import { revokeDeviceKey } from '@/src/actions/keys' 
import { removePrivateKey } from '@/src/lib/device-key-store'
import { RequirePin } from '@/components/ui/digital-signatures/RequirePin'
import { UserKey } from '@/src/types/keys'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Monitor, ShieldOff, AlertTriangle } from 'lucide-react'

type Props = {
    keys: UserKey[]
    userId: string
    entityId: string
}

export function DeviceKeysSettings({ keys, userId, entityId }: Props) {
    // Tracks which key ID is currently showing the PIN dialog
    const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null)

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
                            className="border border-border rounded-lg p-4 flex flex-col gap-4"
                        >
                            {/* Standard Row Information */}
                            <div className="flex items-center justify-between">
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
                                    
                                    {key.status === 'active' && revokingKeyId !== key.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setRevokingKeyId(key.id)}
                                            className="text-destructive hover:text-destructive gap-1"
                                        >
                                            <ShieldOff className="h-4 w-4" />
                                            Revoke
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Conditional PIN Input Section */}
                            {revokingKeyId === key.id && (
                                <div className="mt-2 pt-4 border-t border-border/50">
                                    <div className="flex items-center gap-2 mb-4 text-sm text-destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <span>Enter your 6-digit PIN to authorize revocation. This device will immediately lose signing privileges.</span>
                                    </div>
                                    
                                    <RequirePin 
                                        userId={userId}
                                        entityId={entityId}
                                        buttonLabel="Authorize Revocation"
                                        actionPayload={{
                                            event_type: 'REVOKE_KEY',
                                            table_name: 'user_keys',
                                            record_id: key.id,
                                            payload: { status: 'revoked' }
                                        }}
                                        onSuccess={async ({ signature, timestamp, signingPayload }) => {
                                            await revokeDeviceKey(key.id, signature, timestamp, signingPayload)
                                            await removePrivateKey(userId)
                                            window.location.reload()
                                        }}
                                        onCancel={() => setRevokingKeyId(null)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}