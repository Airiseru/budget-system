'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { deleteItemCatalogAction } from '@/src/actions/items'

type Props = {
    itemId: string
    itemName: string
}

export function DeleteItemCatalogForm({ itemId, itemName }: Props) {
    const [state, action, pending] = useActionState(deleteItemCatalogAction, undefined)

    return (
        <form action={action} className="space-y-6 border border-red-200 bg-red-50/50 rounded-lg p-6">
            {state?.formErrors && state.formErrors.length > 0 && (
                <div className="bg-white border border-red-400 text-red-700 px-4 py-3 rounded">
                    <p className="font-semibold text-sm">{state.formErrors[0]}</p>
                </div>
            )}

            <input type="hidden" name="id" value={itemId} />

            <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold text-red-600">Delete Item Catalog Entry</h2>
                <p className="text-gray-700">
                    Are you sure you want to delete <strong>{itemName}</strong>?
                </p>
                <p className="text-sm text-gray-500 italic">
                    This permanently removes the item catalog record.
                </p>
            </div>

            <div className="flex gap-4 mt-6">
                <Link href="/dbm/items" className="w-1/2">
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
                    {pending ? 'Deleting...' : 'Delete Item'}
                </Button>
            </div>
        </form>
    )
}
