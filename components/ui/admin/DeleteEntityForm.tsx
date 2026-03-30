'use client'

import { useActionState } from 'react'
import { deleteEntityAction } from '@/src/actions/entities'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

type Props = {
    entityId: string
    entityType: 'department' | 'agency' | 'operating_unit'
    entityName: string
}

export function DeleteEntityForm({ entityId, entityType, entityName }: Props) {
    const [state, action, pending] = useActionState(deleteEntityAction, undefined)

    return (
        <form action={action} className="space-y-6 border border-red-200 bg-red-50/50 rounded-lg p-6">
            
            {/* Display errors if they try to delete an entity with connected children */}
            {(state?.formErrors && state.formErrors.length > 0) && (
                <div className="bg-white border border-red-400 text-red-700 px-4 py-3 rounded">
                    <p className="font-semibold text-sm">{state.formErrors[0]}</p>
                </div>
            )}

            <input type="hidden" name="entity_id" value={entityId} />
            <input type="hidden" name="entity_type" value={entityType} />

            <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold text-red-600">Confirm Deletion</h2>
                <p className="text-gray-700">
                    Are you sure you want to permanently delete <strong>{entityName}</strong>? 
                </p>
                <p className="text-sm text-gray-500 italic">
                    This action cannot be undone. All associated data will be removed.
                </p>
            </div>

            <div className="flex gap-4 mt-6">
                <Link href="/admin/entities" className="w-1/2">
                    <Button type="button" variant="default" className="w-full py-5 text-md bg-gray-200 text-gray-700">
                        Cancel
                    </Button>
                </Link>
                <Button 
                    type="submit" 
                    disabled={pending} 
                    variant="destructive" 
                    className="w-1/2 py-5 text-md"
                >
                    {pending ? 'Deleting...' : 'Yes, Delete Entity'}
                </Button>
            </div>
        </form>
    )
}