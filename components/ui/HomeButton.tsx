'use client'

import { useRouter } from 'next/navigation'

export function HomeButton({ url, text='Home',  ...props }: { url?: string, text?: string, [key: string]: any }) {
    const router = useRouter()
    return (
        <button
            onClick={() => router.push(url ?? '/')}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md"
            {...props}
        >
            {text}
        </button>
    )
}