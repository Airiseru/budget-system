'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BackButtonProps {
    url?: string
    className?: string
    label?: string
    variant?: "outline" | "default" | "secondary" | "ghost" | "destructive" | "link" | null | undefined
}

export default function BackButton({ url, label = 'Back', className, variant = 'outline' }: BackButtonProps) {
    const router = useRouter()

    return (
        <Button
            variant={variant}
            onClick={() => url ? router.push(url) : router.back()}
            className={className}
        >
            <ArrowLeft className="h-4 w-4" />
            {label}
        </Button>
    )
}