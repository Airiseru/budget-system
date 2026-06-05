'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { inactivateUacsCodeAction } from '@/src/actions/uacs'
import { UacsCategory } from '@/src/db/postgres/repositories/uacsRepository'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const SCOPE_OPTIONS: Record<UacsCategory, { value: string; label: string }[]> = {
    funding_source: [
        { value: 'record', label: 'Only this record' },
        { value: 'cluster', label: 'This cluster and all descendants' },
        { value: 'financing', label: 'This financing branch and all descendants' },
        { value: 'auth', label: 'This authorization branch and all descendants' },
    ],
    location: [
        { value: 'record', label: 'Only this record' },
        { value: 'region', label: 'This region and all descendants' },
        { value: 'province', label: 'This province and all descendants' },
        { value: 'city_municipality', label: 'This city / municipality and all descendants' },
    ],
    object_code: [
        { value: 'record', label: 'Only this record' },
        { value: 'chart_account', label: 'This chart of accounts branch and all descendants' },
    ],
}

export function InactivateUacsForm({
    category,
    code,
    description,
}: {
    category: UacsCategory
    code: string
    description: string
}) {
    const [state, action, pending] = useActionState(inactivateUacsCodeAction, undefined)

    const [selectedScope, setSelectedScope] = useState(state?.values?.scope ?? 'record')

    const handleScopeChange = (value: string | null) => {
        setSelectedScope(value ?? 'record')
    }

    return (
        <form action={action} className="space-y-6 border border-border rounded-lg p-6">
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="code" value={code} />

            <div className="space-y-1">
                <p className="font-medium">{code}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            {state?.formErrors?.[0] && (
                <p className="text-sm text-red-500 italic">{state.formErrors[0]}</p>
            )}

            <div className="space-y-2">
                <label htmlFor="scope" className="font-medium">Cascade Scope</label>
                <input name="scope" id="scope" type="hidden" value={selectedScope} required />

                <Select
                    value={selectedScope}
                    onValueChange={handleScopeChange}
                >
                    <SelectTrigger className="border px-3 py-5 w-full rounded my-1 border-border text-base">
                        <SelectValue placeholder="Select a status">
                            {SCOPE_OPTIONS[category].find((option) => option.value === selectedScope)?.label}
                        </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                        {SCOPE_OPTIONS[category].map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    This will set the selected code or branch to inactive.
                </p>
            </div>

            <Button type="submit" disabled={pending} className="w-full" variant="destructive">
                {pending ? 'Inactivating...' : 'Set Inactive'}
            </Button>
        </form>
    )
}
