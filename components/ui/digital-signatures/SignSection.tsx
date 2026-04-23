'use client'

import { Workflow, getNextStatus } from '@/src/lib/workflows'
import { SignButton } from './SignButton'
import { SignatureVerificationBadge } from './SignatureVerificationBadge'
import { ShieldCheck } from 'lucide-react'
import { WORKFLOW_ROLE_LABELS, STATUS_MESSAGES } from '@/src/lib/constants'

type Props = {
    formId: string
    tableName: string
    formData: object
    userId: string
    entityId: string
    authStatus: string
    userCanSign: boolean
    signatoryRole?: string
    nextSignatoryRole?: string
    alreadySigned: boolean
    signatories?: {
        id: string
        user_name: string
        role: string
        created_at: Date
    }[]
    workflow: Workflow
}

export function SignSection({
    formId,
    tableName,
    formData,
    userId,
    entityId,
    authStatus,
    userCanSign,
    signatoryRole,
    alreadySigned,
    signatories = [],
    workflow
}: Props) {
    return (
        <div className="border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg">Signatures</h3>

            {/* status message */}
            <p className="text-sm text-muted-foreground">
                {STATUS_MESSAGES[authStatus] ?? authStatus}
            </p>

            {/* existing signatures */}
            {signatories.length > 0 && (
                <div className="space-y-2">
                    {signatories.map(sig => (
                        <SignatureVerificationBadge
                            entityId={entityId}
                            formId={formId}
                            tableName={tableName}
                            key={sig.id}
                            signatoryId={sig.id}
                            formData={formData}
                            signerName={`${sig.user_name} (${WORKFLOW_ROLE_LABELS[sig.role] ?? sig.role})`}
                            signedAt={sig.created_at}
                        />
                    ))}
                </div>
            )}

            {/* sign button */}
            {alreadySigned ? (
                <div className="flex items-center gap-2 text-emerald-600">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-sm font-medium">
                        You have already signed this document as {WORKFLOW_ROLE_LABELS[signatoryRole ?? ''] ?? signatoryRole}
                    </span>
                </div>
            ) : userCanSign && signatoryRole ? (
                <div className="space-y-2">
                    <p className="text-sm font-medium">
                        Sign as {WORKFLOW_ROLE_LABELS[signatoryRole]}
                    </p>
                    <SignButton
                        entityId={entityId}
                        tableName={tableName}
                        formId={formId}
                        formData={formData}
                        userId={userId}
                        signatoryRole={signatoryRole}
                        fromAuthStatus={authStatus}
                        toAuthStatus={getNextStatus(authStatus, workflow, 'approve') ?? ''}
                    />
                </div>
            ) : authStatus !== 'approved' ? (
                <p className="text-sm text-muted-foreground italic">
                    You are not authorized to sign at this stage.
                </p>
            ) : null}
        </div>
    )
}