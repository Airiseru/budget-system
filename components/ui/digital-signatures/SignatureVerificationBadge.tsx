'use client'

import { useEffect, useState } from 'react'
import { verifyFormSignature } from '@/src/actions/keys'
import { ShieldCheck, ShieldX, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type Props = {
    signatoryId: string
    formData: object
    signerName: string
    signedAt: Date
}

export function SignatureVerificationBadge({ signatoryId, formData, signerName, signedAt }: Props) {
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading')
    const [details, setDetails] = useState<string | null>(null)

    useEffect(() => {
        verifyFormSignature(signatoryId, formData)
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
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{signerName}</p>
                    <Badge variant={
                        status === 'loading' ? 'secondary' :
                        status === 'valid' ? 'default' : 'destructive'
                    }>
                        {status === 'loading' ? 'Verifying...' :
                         status === 'valid' ? 'Valid' : 'Invalid'}
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Signed {new Date(signedAt).toLocaleString()}
                </p>
                {details && (
                    <p className="text-xs text-destructive mt-0.5">{details}</p>
                )}
            </div>
        </div>
    )
}