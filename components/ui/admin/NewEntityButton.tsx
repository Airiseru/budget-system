"use client"

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default function NewEntityButton({ basePath = '/admin/entities' }: { basePath?: string }) {
    return (
        <Link href={`${basePath}/new`}>
            <Button variant="outline" className="flex flex-row items-center gap-2">
                <Plus className="h-4 w-4" />
                New Entity
            </Button>
        </Link>
    )
}
