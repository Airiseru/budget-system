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
import { UserEntity, UserRole, UserAccessLevel } from '@/src/types/entities'

const roleLabels: Record<string, string> = {
    agency: 'Agency',
    dbm: 'DBM',
    admin: 'Administrator',
}

const accessLevelLabels: Record<string, string> = {
    view: 'Viewer',
    encode: 'Encoder',
    review: 'Reviewer',
    approve: 'Approver',
}

export function PendingUsersTable({ users }: { users: UserEntity[] }) {
    if (users.length === 0) {
        return (
            <div className="border border-border border-dashed rounded-lg p-12 text-center text-muted-foreground">
                No pending users require approval at this time.
            </div>
        )
    }

    return (
        <div className="border border-border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>User Details</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Organization Role</TableHead>
                        <TableHead>Access Level</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => (
                        <UserApprovalRow key={user.user_id} user={user} />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function UserApprovalRow({ user }: { user: UserEntity }) {
    const [role, setRole] = useState<string>("")
    const [accessLevel, setAccessLevel] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)

    async function handleApprove() {
        if (!role || !accessLevel) return
        
        setIsLoading(true)
        try {
            await approveUser(user.user_id, role as UserRole, accessLevel as UserAccessLevel)
        } catch (error) {
            console.error("Failed to approve user", error)
            setIsLoading(false)
        }
    }

    async function handleDeny() {
        if (confirm(`Are you sure you want to permanently delete ${user.user_email}?`)) {
            setIsLoading(true)
            try {
                await denyUser(user.user_id)
            } catch (error) {
                console.error("Failed to deny user", error)
                setIsLoading(false)
            }
        }
    }

    return (
        <TableRow>
            <TableCell>
                <div className="font-medium text-foreground">{user.user_name}</div>
                <div className="text-xs text-muted-foreground">{user.user_email}</div>
            </TableCell>

            <TableCell>
                <div className="font-medium text-foreground">{user.position}</div>
                <div className="text-xs text-muted-foreground">{user.entity_name}</div>
            </TableCell>
            
            <TableCell>
                <Select value={role} onValueChange={(val) => setRole(val || "")} disabled={isLoading}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select Role">
                        {role ? roleLabels[role] : 'Select Role'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="agency">Agency</SelectItem>
                        <SelectItem value="dbm">DBM</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell>
                <Select value={accessLevel} onValueChange={(val) => setAccessLevel(val || "")} disabled={isLoading}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Select Level">
                            {accessLevel ? accessLevelLabels[accessLevel] : 'Select Level'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="view">Viewer</SelectItem>
                        <SelectItem value="encode">Encoder</SelectItem>
                        <SelectItem value="review">Reviewer</SelectItem>
                        <SelectItem value="approve">Approver</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell className="text-right flex justify-end gap-2">
                <Button 
                    variant="destructive" 
                    size="icon" 
                    onClick={handleDeny}
                    disabled={isLoading}
                    title="Deny & Delete"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
                
                <Button 
                    variant="default" 
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" 
                    onClick={handleApprove}
                    // Disable the button until both dropdowns are filled
                    disabled={!role || !accessLevel || isLoading} 
                >
                    <Check className="w-4 h-4" />
                    Approve
                </Button>
            </TableCell>
        </TableRow>
    )
}