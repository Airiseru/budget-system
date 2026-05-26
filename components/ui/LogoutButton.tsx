'use client'

import { logout } from "@/src/actions/auth"
import { LogOut } from "lucide-react"
import { Button } from '@/components/ui/button'

interface LogoutButtonProps {
    className?: string
    label?: string
    variant?: "outline" | "default" | "secondary" | "ghost" | "destructive" | "link" | null | undefined
}

export function LogoutButton({ label = 'Logout', className="items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-secondary-foreground shadow-sm transition hover:bg-secondary-foreground hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variant = 'default' }: LogoutButtonProps) {
    return (
        <form action={logout}>
            <Button
                variant={variant}
                className={className || 'bg-gray-200 text-gray-700 px-4 py-5 rounded-md'}
                type="submit"
            >
                <LogOut className="h-4 w-4" />
                {label}
            </Button>
        </form>
    )
}