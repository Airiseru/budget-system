'use client'

import { useEffect, useState } from 'react'
import { verifyFormSignature } from '@/src/actions/keys'
import { buildSignaturePayload, sha256 } from '@/src/lib/audit-hash'
import { canonicalStringify } from '@/src/lib/canonical'
import { ShieldCheck, ShieldX, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Props = {
    userId: string
    entityId: string
    tableName: string
    formId: string
    signatoryId: string
    formData: object
    signerName: string
    signatoryRole: string
    nextRole: string
    signedAt: Date
}

export function SignatureVerificationBadge({ userId, entityId, tableName, formId, signatoryId, formData, signerName, signatoryRole, nextRole, signedAt }: Props) {
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading')
    const [details, setDetails] = useState<string | null>(null)

    const {
        auth_status, entity_id, created_at, updated_at,
        ...cleanFormData
    } = formData as any

    console.log(`form data in INTEGRITY BADGE: ${canonicalStringify(cleanFormData)}`)

    const signaturePayload = buildSignaturePayload({
        entity_id: entityId,
        user_id: userId,
        event_type: 'SIGN',
        table_name: tableName,
        record_id: formId,
        payload: {
            from_status: signatoryRole,
            to_status: nextRole,
            form_state_hash: sha256(canonicalStringify(cleanFormData)),
        },
        changed_at: signedAt.toISOString(),
    })

    console.log(`signaturePayload in INTEGRITY BADGE: ${signaturePayload}`)

    useEffect(() => {
        verifyFormSignature(signatoryId, signaturePayload)
            .then(result => {
                if (result.isValid) {
                    setStatus('valid')
                } else {
                    setStatus('invalid')
                    if (!result.cryptoValid) setDetails('Signature does not match document')
                    else if (!result.keyValidAtSigning) setDetails('Key was revoked before signing')
                    else if (!result.keyNotExpiredAtSigning) setDetails('Key was expired at signing time')
                }
            })
            .catch(() => {
                setStatus('invalid')
                setDetails('Verification failed')
            })
    }, [signatoryId])

    return (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
            <div className="mt-0.5">
                {status === 'loading' && <Shield className="h-4 w-4 text-muted-foreground animate-pulse" />}
                {status === 'valid' && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                {status === 'invalid' && <ShieldX className="h-4 w-4 text-destructive" />}
            </div>
            
            <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium">{signerName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Signed {new Date(signedAt).toLocaleString()}
                    </p>
                    {details && (
                        <p className="text-xs text-destructive mt-1 font-medium">{details}</p>
                    )}
                </div>

                <Badge
                    variant={status === 'invalid' ? 'destructive' : 'secondary'}
                    className={
                        status === 'valid' 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-none border-transparent' 
                        : 'shadow-none'
                    }
                >
                    {status === 'loading' ? 'Verifying...' :
                     status === 'valid' ? 'Valid' : 'Invalid'}
                </Badge>
                
            </div>
        </div>
    )
}