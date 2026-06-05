'use client'

import { useState } from 'react'
import { approveUser, denyUser } from '@/src/actions/admin'
import { Button } from '@/components/ui/button'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Check, Trash2 } from 'lucide-react'
import { UserEntity, UserRole, UserAccessLevel, UserWorkflowRole } from '@/src/types/entities'
import { ROLE_LABELS, ACCESS_LEVEL_LABELS, WORKFLOW_ROLE_LABELS } from '@/src/lib/constants'
import LoadingOverlay from '@/components/ui/LoadingOverlay'

export function PendingUsersTable({ users }: { users: UserEntity[] }) {
    const [pendingRejectUser, setPendingRejectUser] = useState<UserEntity | null>(null)
    const [isRejecting, setIsRejecting] = useState(false)
    const [isApproving, setIsApproving] = useState(false)

    async function handleConfirmReject() {
        if (!pendingRejectUser) return

        setIsRejecting(true)
        try {
            await denyUser(pendingRejectUser.user_id)
            setPendingRejectUser(null)
        } catch (error) {
            console.error("Failed to deny user", error)
        } finally {
            setIsRejecting(false)
        }
    }

    if (users.length === 0) {
        return (
            <div className="border border-border border-dashed rounded-lg p-12 text-center text-muted-foreground">
                No pending users require approval at this time.
            </div>
        )
    }

    return (
        <>
            <LoadingOverlay show={isRejecting || isApproving} label={isRejecting ? "Rejecting user..." : "Approving user..."} />
            <div className="border border-border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User Details</TableHead>
                            <TableHead className="w-md">Position</TableHead>
                            <TableHead>Parent Entity</TableHead>
                            <TableHead>Organization Role</TableHead>
                            <TableHead>Workflow Role</TableHead>
                            <TableHead>Access Level</TableHead>
                            <TableHead>Admin</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <UserApprovalRow
                                key={user.user_id}
                                user={user}
                                onRequestReject={() => setPendingRejectUser(user)}
                                onLoadingChange={setIsApproving}
                            />
                        ))}
                    </TableBody>
                </Table>
            </div>

            {pendingRejectUser ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg">
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-foreground">Reject pending user?</h3>
                            <p className="text-sm text-muted-foreground">
                                This will reject <span className="font-medium text-foreground">{pendingRejectUser.user_email}</span> and archive the pending account.
                            </p>
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setPendingRejectUser(null)}
                                disabled={isRejecting}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleConfirmReject}
                                disabled={isRejecting}
                            >
                                Reject User
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    )
}

function UserApprovalRow({
    user,
    onRequestReject,
    onLoadingChange,
}: {
    user: UserEntity
    onRequestReject: () => void
    onLoadingChange: (loading: boolean) => void
}) {
    const [role, setRole] = useState<string>("")
    const [accessLevel, setAccessLevel] = useState<string>("")
    const [workflowRole, setWorkflowRole] = useState<string>("")
    const [isAdmin, setIsAdmin] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    async function handleApprove() {
        if (!role || !accessLevel || !workflowRole) return
        
        setIsLoading(true)
        onLoadingChange(true)
        try {
            const finalWorkflowRole = workflowRole === 'none' ? null : workflowRole

            await approveUser(
                user.user_id,
                role as UserRole,
                accessLevel as UserAccessLevel,
                finalWorkflowRole as UserWorkflowRole,
                isAdmin
            )
        } catch (error) {
            console.error("Failed to approve user", error)
        } finally {
            setIsLoading(false)
            onLoadingChange(false)
        }
    }

    return (
        <TableRow>
            <TableCell>
                <div className="font-medium text-foreground whitespace-normal break-word">{user.user_name}</div>
                <div className="text-xs text-muted-foreground whitespace-normal break-word">{user.user_email}</div>
            </TableCell>

            <TableCell className="w-md align-middle">
                <div className="font-medium text-foreground whitespace-normal break-word">{user.position}</div>
                <div className="text-xs text-muted-foreground whitespace-normal break-word">{user.entity_name}</div>
            </TableCell>

            <TableCell>
                <div className="text-sm text-foreground whitespace-normal break-words">
                    {user.parent_entity_name || '—'}
                </div>
            </TableCell>
            
            <TableCell>
                <Select value={role} onValueChange={(val) => setRole(val || "")} disabled={isLoading}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select Role">
                        {role ? ROLE_LABELS[role] : 'Select Role'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([role, label]) => (
                            <SelectItem key={role} value={role}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell>
                <Select value={workflowRole} onValueChange={(val) => setWorkflowRole(val || "")} disabled={isLoading}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select Role">
                        {workflowRole ? WORKFLOW_ROLE_LABELS[workflowRole] : 'Select Workflow Role'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(WORKFLOW_ROLE_LABELS).map(([role, label]) => (
                            <SelectItem key={role} value={role}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell>
                <Select value={accessLevel} onValueChange={(val) => setAccessLevel(val || "")} disabled={isLoading}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select Level">
                            {accessLevel ? ACCESS_LEVEL_LABELS[accessLevel] : 'Select Level'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(ACCESS_LEVEL_LABELS).map(([level, label]) => (
                            <SelectItem key={level} value={level}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={isAdmin}
                        onChange={(event) => setIsAdmin(event.target.checked)}
                        disabled={isLoading}
                        className='mx-auto'
                    />
                </label>
            </TableCell>

            <TableCell className="align-middle">
                <div className="flex items-center justify-end gap-2">
                <Button 
                    variant="destructive" 
                    size="icon" 
                    onClick={onRequestReject}
                    disabled={isLoading}
                    title="Reject User"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
                
                <Button 
                    variant="default" 
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" 
                    onClick={handleApprove}
                    disabled={!role || !accessLevel || !workflowRole || isLoading} 
                >
                    <Check className="w-4 h-4" />
                    Approve
                </Button>
                </div>
            </TableCell>
        </TableRow>
    )
}
