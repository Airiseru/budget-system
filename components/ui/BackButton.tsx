'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BackButtonProps {
    url?: string
    className?: string
    label?: string
}

export default function BackButton({ url, label = 'Back', className }: BackButtonProps) {
    const router = useRouter()

    return (
        <Button
            variant="outline"
            onClick={() => url ? router.push(url) : router.back()}
            className={className}
        >
            <ArrowLeft className="h-4 w-4" />
            {label}
        </Button>
    )
}