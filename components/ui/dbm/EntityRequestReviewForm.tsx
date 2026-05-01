'use client'

import { useActionState } from 'react'
import { approveEntityRequestAction, rejectEntityRequestAction } from '@/src/actions/entities'
import { Button } from '@/components/ui/button'
import { ENTITY_TYPE_LABELS } from '@/src/lib/constants'

type RequestData = {
    id: string
    proposed_name: string
    proposed_abbr: string | null
    proposed_classification: string
    proposed_agency_type: string | null
    proposed_parent_department_id: string | null
    proposed_parent_agency_id: string | null
    proposed_parent_ou_id: string | null
    legal_basis: string
    requested_by_user_name: string | null
    requested_by_entity_name: string
    proposed_parent_department_name: string | null
    proposed_parent_agency_name: string | null
    proposed_parent_ou_name: string | null
}

export function EntityRequestReviewForm({ request }: { request: RequestData }) {
    const [approveState, approveAction, approvePending] = useActionState(approveEntityRequestAction, undefined)
    const [rejectState, rejectAction, rejectPending] = useActionState(rejectEntityRequestAction, undefined)

    return (
        <div className="space-y-6">
            <section className="border border-border rounded-lg p-6 space-y-3">
                <h2 className="text-xl font-semibold">Request Details</h2>
                <p><span className="font-medium">Requested by:</span> {request.requested_by_user_name ?? 'Unknown'} from {request.requested_by_entity_name}</p>
                <p><span className="font-medium">Requested entity:</span> {request.proposed_name}{request.proposed_abbr ? ` (${request.proposed_abbr})` : ''}</p>
                <p><span className="font-medium">Classification:</span> {ENTITY_TYPE_LABELS[request.proposed_classification]}</p>
                {request.proposed_agency_type && <p><span className="font-medium">Agency type:</span> {request.proposed_agency_type}</p>}
                {request.proposed_parent_department_name && <p><span className="font-medium">Parent department:</span> {request.proposed_parent_department_name}</p>}
                {request.proposed_parent_agency_name && <p><span className="font-medium">Parent agency:</span> {request.proposed_parent_agency_name}</p>}
                {request.proposed_parent_ou_name && <p><span className="font-medium">Parent OU:</span> {request.proposed_parent_ou_name}</p>}
                <div>
                    <p className="font-medium">Legal basis</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.legal_basis}</p>
                </div>
            </section>

            <form action={approveAction} className="border border-border rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold">Approve Request</h3>
                {approveState?.formErrors?.[0] && <p className="text-red-500 text-sm italic">{approveState.formErrors[0]}</p>}
                <input type="hidden" name="request_id" value={request.id} />
                <input type="hidden" name="proposed_name" value={request.proposed_name} />
                <input type="hidden" name="proposed_abbr" value={request.proposed_abbr ?? ''} />
                <input type="hidden" name="proposed_classification" value={request.proposed_classification} />
                <input type="hidden" name="proposed_agency_type" value={request.proposed_agency_type ?? ''} />
                <input type="hidden" name="proposed_parent_department_id" value={request.proposed_parent_department_id ?? ''} />
                <input type="hidden" name="proposed_parent_agency_id" value={request.proposed_parent_agency_id ?? ''} />
                <input type="hidden" name="proposed_parent_ou_id" value={request.proposed_parent_ou_id ?? ''} />
                <input type="hidden" name="legal_basis" value={request.legal_basis} />

                <div className="space-y-2">
                    <label className="font-medium">UACS Code</label>
                    <input name="uacs_code" defaultValue={approveState?.values?.uacs_code ?? ''} className="border border-border px-3 py-2 w-full rounded bg-background font-mono" required />
                </div>

                <div className="space-y-2">
                    <label className="font-medium">DBM Remarks</label>
                    <textarea name="dbm_remarks" defaultValue={approveState?.values?.dbm_remarks ?? ''} className="border border-border px-3 py-2 w-full rounded bg-background min-h-24 resize-y" />
                </div>

                <Button type="submit" disabled={approvePending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {approvePending ? 'Approving...' : 'Approve and Create Entity'}
                </Button>
            </form>

            <form action={rejectAction} className="border border-red-200 bg-red-50/50 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-red-700">Reject Request</h3>
                {rejectState?.formErrors?.[0] && <p className="text-red-500 text-sm italic">{rejectState.formErrors[0]}</p>}
                {rejectState?.fieldErrors?.dbm_remarks?.[0] && <p className="text-red-500 text-sm italic">{rejectState.fieldErrors.dbm_remarks[0]}</p>}
                <input type="hidden" name="request_id" value={request.id} />
                <div className="space-y-2">
                    <label className="font-medium">Rejection Remarks</label>
                    <textarea name="dbm_remarks" defaultValue={rejectState?.values?.dbm_remarks ?? ''} className="border border-red-200 px-3 py-2 w-full rounded bg-white min-h-24 resize-y" required />
                </div>
                <Button type="submit" disabled={rejectPending} variant="destructive">
                    {rejectPending ? 'Rejecting...' : 'Reject Request'}
                </Button>
            </form>
        </div>
    )
}
