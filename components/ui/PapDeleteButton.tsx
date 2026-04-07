'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PapDeleteButton({ id }: { id: string }) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    async function handleDelete() {
        if (!confirm('Are you sure you want to delete this PAP?')) return

        setIsLoading(true)

        try {
            const res = await fetch(`/api/paps/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            router.push('/paps')
        } catch (err) {
            alert('Failed to delete PAP')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive text-white px-4 py-2 rounded-md hover:bg-destructive/90 disabled:opacity-50"
        >
            {isLoading ? 'Deleting...' : 'Delete'}
        </button>
    )
}