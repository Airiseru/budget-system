'use client'

import { authClient } from '@/src/lib/auth-client'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
    const router = useRouter()

    return (
        <button
            onClick={() => authClient.signOut({
                fetchOptions: {
                    onSuccess: () => router.push('/login')
                }
            })}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md"
        >
            Logout
        </button>
    )
}