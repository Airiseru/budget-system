'use client'

import { ShieldAlert } from "lucide-react"

export function PendingAlert() {
    return (
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground flex items-center gap-2">
                <ShieldAlert className="text-amber-500" />
                Pending Approvals
            </h1>
            <p className="text-muted-foreground mt-2">
                Review and assign access levels to newly registered system users.
            </p>
        </div>
    )
}