'use client'

import { useEffect, useState } from 'react'
import { verifyFormSignature } from '@/src/actions/keys'
import { buildSignaturePayload, sha256 } from '@/src/lib/audit-hash'
import { canonicalStringify } from '@/src/lib/canonical'
import { ShieldCheck, ShieldX, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Props = {
    entityId: string
    tableName: string
    formId: string
    signatoryId: string
    formData: object
    signerName: string
    signedAt: Date
}

export function SignatureVerificationBadge({ entityId, tableName, formId, signatoryId, formData, signerName, signedAt }: Props) {
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading')
    const [details, setDetails] = useState<string | null>(null)

    useEffect(() => {
        verifyFormSignature(entityId, formId, tableName, signatoryId, formData)
            .then(result => {
                if (result.isValid) {
                    setStatus('valid')
                } else {
                    setStatus('invalid')
                    if (!result.cryptoValid) setDetails(result.reason || 'Signature does not match document')
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