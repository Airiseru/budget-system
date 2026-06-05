'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ENTITY_TYPE_LABELS } from '@/src/lib/constants'

type RequestRow = {
    id: string
    proposed_name: string
    proposed_abbr: string | null
    proposed_classification: string
    proposed_agency_type: string | null
    legal_basis: string
    status: string
    created_at: Date
    requested_by_user_name: string | null
    requested_by_entity_name: string
}

export function EntityRequestsTable({ requests }: { requests: RequestRow[] }) {
    if (requests.length === 0) {
        return (
            <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                No pending entity requests.
            </div>
        )
    }

    return (
        <div className="border border-border rounded-md overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Requested Entity</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Legal Basis</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {requests.map(request => (
                        <TableRow key={request.id}>
                            <TableCell>
                                <div className="font-medium">{request.proposed_name}</div>
                                {request.proposed_abbr && (
                                    <div className="text-xs text-muted-foreground">{request.proposed_abbr}</div>
                                )}
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary">
                                    {ENTITY_TYPE_LABELS[request.proposed_classification]}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="font-medium">{request.requested_by_user_name ?? 'Unknown requester'}</div>
                                <div className="text-xs text-muted-foreground">{request.requested_by_entity_name}</div>
                            </TableCell>
                            <TableCell className="max-w-sm truncate">{request.legal_basis}</TableCell>
                            <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                                <Link href={`/dbm/entity-requests/${request.id}`}>
                                    <Button variant="outline">Review</Button>
                                </Link>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
