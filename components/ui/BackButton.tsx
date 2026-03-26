'use client'

import { useRouter } from 'next/navigation'

export function BackButton({ ...props}) {
    const router = useRouter()
    
    return (
        <button
            className="btn btn-primary"
            onClick={() => router.back()}
            {...props}
        >
            Back
        </button>
    )
}