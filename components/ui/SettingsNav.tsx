"use client"

import Link from 'next/link'
import { KeyRound, User } from 'lucide-react'

export default function SettingsNav({ canAccessKeys }: { canAccessKeys: boolean }) {
    return (
        <div className="flex gap-2 flex-col">
            <Link href="/home/settings/user">
                <div className="flex items-center gap-4 border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="p-2 rounded-md bg-muted">
                        <User className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                        <p className="font-medium">User Settings</p>
                        <p className="text-sm text-muted-foreground">
                            Update your name, email, and password
                        </p>
                    </div>
                </div>
            </Link>

            {canAccessKeys && (
                <Link href="/home/settings/keys">
                    <div className="flex items-center gap-4 border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="p-2 rounded-md bg-muted">
                            <KeyRound className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                            <p className="font-medium">Signing Keys</p>
                            <p className="text-sm text-muted-foreground">
                                Manage your device signing keys and PIN
                            </p>
                        </div>
                    </div>
                </Link>
            )}
        </div>
    )
}