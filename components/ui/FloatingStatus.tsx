'use client'

import { useEffect } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FloatingStatusMessage = {
    type: 'success' | 'error'
    message: string
} | null

type Props = {
    status: FloatingStatusMessage
    onClear: () => void
    durationMs?: number
    className?: string
}

export default function FloatingStatus({
    status,
    onClear,
    durationMs = 3500,
    className,
}: Props) {
    useEffect(() => {
        if (!status) return

        const timeout = window.setTimeout(onClear, durationMs)

        return () => window.clearTimeout(timeout)
    }, [durationMs, onClear, status])

    if (!status) return null

    const isSuccess = status.type === 'success'
    const Icon = isSuccess ? CheckCircle2 : XCircle

    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                'fixed left-1/2 top-4 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur',
                isSuccess
                    ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800'
                    : 'border-red-200 bg-red-50/95 text-red-800',
                className
            )}
        >
            <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{status.message}</span>
            </div>
        </div>
    )
}
