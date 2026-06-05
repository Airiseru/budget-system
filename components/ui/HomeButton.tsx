'use client'

import { useRouter } from 'next/navigation'
import { ButtonHTMLAttributes } from 'react'

type HomeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    url?: string
    text?: string
}

export function HomeButton({ url, text='Home',  ...props }: HomeButtonProps) {
    const router = useRouter()
    return (
        <button
            onClick={() => router.push(url ?? '/home')}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md"
            {...props}
        >
            {text}
        </button>
    )
}
