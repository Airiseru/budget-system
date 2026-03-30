'use client'

import { logout } from "@/src/actions/auth"
import { LogOut } from "lucide-react"
import { Button } from '@/components/ui/button'

interface LogoutButtonProps {
    className?: string
    label?: string
    variant?: "outline" | "default" | "secondary" | "ghost" | "destructive" | "link" | null | undefined
}

export function LogoutButton({ label = 'Logout', className, variant = 'default' }: LogoutButtonProps) {
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