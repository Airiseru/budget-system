'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface BackButtonProps {
    url?: string
    className?: string
    label?: string
    variant?: "outline" | "default" | "secondary" | "ghost" | "destructive" | "link" | null | undefined
}

export default function GeneralButton({ url, label = 'Back', className, variant = 'outline' }: BackButtonProps) {
    const router = useRouter()

    return (
        <Button
            variant={variant}
            onClick={() => url ? router.push(url) : '/'}
            className={className}
        >
            {label}
        </Button>
    )
}