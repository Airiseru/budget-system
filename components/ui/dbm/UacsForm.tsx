'use client'

import { useActionState, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createUacsCodeAction, updateUacsCodeAction } from '@/src/actions/uacs'
import { UacsFormState } from '@/src/lib/validations/uacs'
import { UACS_CATEOGIRES } from '@/src/lib/constants'

type Props = {
    category: UACS_CATEOGIRES
    mode: 'create' | 'edit'
    initialValues?: Record<string, string | null>
    code?: string
}

const CATEGORY_LABELS: Record<UACS_CATEOGIRES, string> = {
    funding_source: 'Funding Source',
    location: 'Location',
    object_code: 'Object Code',
}

const SCOPE_OPTIONS: Record<UACS_CATEOGIRES, { value: string; label: string }[]> = {
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

function Field({
    label,
    name,
    defaultValue,
    state,
    placeholder,
    required = false,
}: {
    label: string
    name: string
    defaultValue?: string | null
    state: UacsFormState
    placeholder?: string
    required?: boolean
}) {
    return (
        <div className="space-y-2">
            <label htmlFor={name} className="font-medium">{label}</label>
            <input
                name={name}
                id={name}
                defaultValue={state?.values?.[name] ?? defaultValue ?? ''}
                required={required}
                className="border border-border px-3 py-2 w-full rounded bg-background my-1"
                placeholder={placeholder}
            />
            {state?.fieldErrors?.[name]?.[0] && (
                <p className="text-sm text-red-500 italic">{state.fieldErrors[name]?.[0]}</p>
            )}
        </div>
    )
}

export function UacsForm({ category, mode, initialValues, code }: Props) {
    const actionFn = mode === 'create' ? createUacsCodeAction : updateUacsCodeAction
    const [state, action, pending] = useActionState(actionFn, undefined)
    const [scope, setScope] = useState(state?.values?.scope ?? 'record')

    const isRecordScope = scope === 'record'
    const scopeOptions = SCOPE_OPTIONS[category]
    const submitLabel = mode === 'create' ? `Create ${CATEGORY_LABELS[category]}` : `Save ${CATEGORY_LABELS[category]}`

    const [selectedStatus, setSelectedStatus] = useState(
        state?.values?.status ?? initialValues?.status ?? 'active'
    )

    const handleStatusChange = (value: string | null) => {
        setSelectedStatus(value ?? 'active')
    }

    const helperText = useMemo(() => {
        if (mode === 'create' || isRecordScope) return null
        if (category === 'funding_source') return 'Branch edits only change the selected hierarchy level, status, and the descendant full codes that depend on it.'
        if (category === 'location') return 'Branch edits only change the selected hierarchy level, status, and the descendant full codes that depend on it.'
        return 'Branch edits only change the chart of accounts segment, status, and the descendant full codes that depend on it.'
    }, [category, isRecordScope, mode])

    return (
        <form action={action} className="space-y-6 border border-border rounded-lg p-6">
            <input type="hidden" name="category" value={category} />
            {code && <input type="hidden" name="code" value={code} />}

            {state?.formErrors?.[0] && (
                <p className="text-sm text-red-500 italic">{state.formErrors[0]}</p>
            )}

            {mode === 'edit' && (
                <div className="space-y-2">
                    <label htmlFor='scope' className="font-medium">Cascade Scope</label>
                    <select
                        name="scope"
                        id='scope'
                        value={scope}
                        onChange={(event) => setScope(event.target.value)}
                        className="border border-border px-3 py-2 w-full rounded bg-background"
                    >
                        {scopeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    {helperText && (
                        <p className="text-xs text-muted-foreground">{helperText}</p>
                    )}
                </div>
            )}

            {category === 'funding_source' && (
                <>
                    {isRecordScope && (
                        <Field label="Leaf Description" name="description" defaultValue={initialValues?.description} state={state} placeholder="Full Parent UACS Description" required />
                    )}
                    <Field label="Cluster Description" name="cluster_desc" defaultValue={initialValues?.cluster_desc} state={state} placeholder="Regular Agency Fund" required />
                    <Field label="Cluster Code" name="cluster_code" defaultValue={initialValues?.cluster_code} state={state} placeholder="01" required />
                    {(isRecordScope || scope === 'financing' || scope === 'auth') && (
                        <>
                            <Field label="Fund Financing Description" name="financing_desc" defaultValue={initialValues?.financing_desc} state={state} placeholder="General Fund" required />
                            <Field label="Fund Financing Code" name="financing_code" defaultValue={initialValues?.financing_code} state={state} placeholder="1" required />
                        </>
                    )}
                    {(isRecordScope || scope === 'auth') && (
                        <>
                            <Field label="Authorization Description" name="auth_desc" defaultValue={initialValues?.auth_desc} state={state} placeholder="New General Appropriations" required />
                            <Field label="Authorization Code" name="auth_code" defaultValue={initialValues?.auth_code} state={state} placeholder="01" required />
                        </>
                    )}
                    {isRecordScope && (
                        <>
                            <Field label="Fund Category Description" name="category_desc" defaultValue={initialValues?.category_desc} state={state} placeholder="Specific Budgets of National Government Agencies" required />
                            <Field label="Fund Category Code" name="category_code" defaultValue={initialValues?.category_code} state={state} placeholder="101" required />
                        </>
                    )}
                </>
            )}

            {category === 'location' && (
                <>
                    {isRecordScope && (
                        <Field label="Leaf Description" name="description" defaultValue={initialValues?.description} state={state} placeholder="Full Parent UACS Description" required />
                    )}
                    <Field label="Region Description" name="region_desc" defaultValue={initialValues?.region_desc} state={state} placeholder="Region I - Ilocos" required/>
                    <Field label="Region Code" name="region_code" defaultValue={initialValues?.region_code} state={state} placeholder="01" required />
                    {(isRecordScope || scope === 'province' || scope === 'city_municipality') && (
                        <>
                            <Field label="Province Description" name="province_desc" defaultValue={initialValues?.province_desc} state={state} placeholder="Ilocos Norte" required />
                            <Field label="Province Code" name="province_code" defaultValue={initialValues?.province_code} state={state} placeholder="28" required />
                        </>
                    )}
                    {(isRecordScope || scope === 'city_municipality') && (
                        <>
                            <Field label="City / Municipality Description" name="city_municipality_desc" defaultValue={initialValues?.city_municipality_desc} state={state} placeholder="Adams, Ilocos Norte" required />
                            <Field label="City / Municipality Code" name="city_municipality_code" defaultValue={initialValues?.city_municipality_code} state={state} placeholder="01" required />
                        </>
                    )}
                    {isRecordScope && (
                        <>
                            <Field label="Barangay Description" name="brgy_desc" defaultValue={initialValues?.brgy_desc} state={state} placeholder="ADAMS" required />
                            <Field label="Barangay Code" name="brgy_code" defaultValue={initialValues?.brgy_code} state={state} placeholder="000" required />
                        </>
                    )}
                </>
            )}

            {category === 'object_code' && (
                <>
                    {isRecordScope && (
                        <Field label="Leaf Description" name="description" defaultValue={initialValues?.description} state={state} placeholder="Full Parent UACS Description" required />
                    )}
                    <Field label="Chart of Accounts Description" name="chart_account_desc" defaultValue={initialValues?.chart_account_desc} state={state} placeholder="Cash in Bank - Local Currency, Bangko Sentral ng Pilipinas" required />
                    <Field label="Chart of Accounts Code" name="chart_account_code" defaultValue={initialValues?.chart_account_code} state={state} placeholder="10102010" required />
                    {isRecordScope && (
                        <>
                            <Field label="Sub-object Description" name="sub_object_desc" defaultValue={initialValues?.sub_object_desc} state={state} placeholder="Treasury Single Account" required />
                            <Field label="Sub-object Code" name="sub_object_code" defaultValue={initialValues?.sub_object_code} state={state} placeholder="01" required />
                        </>
                    )}
                </>
            )}

            <div className="space-y-2">
                <label htmlFor="status" className="font-medium">Status</label>
                <input id="status" type="hidden" name="status" value={selectedStatus} required />

                <Select
                    value={selectedStatus}
                    onValueChange={handleStatusChange}
                >
                    <SelectTrigger className="border px-3 py-5 w-full rounded my-1 border-border text-base">
                        <SelectValue placeholder="Select a status">
                            {selectedStatus === 'active' ? 'Active' : 'Inactive'}
                        </SelectValue>
                    </SelectTrigger>

                    <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Button type="submit" disabled={pending} className="w-full bg-accent-foreground text-white hover:bg-accent-foreground/90 py-5 text-md">
                {pending ? 'Saving...' : submitLabel}
            </Button>
        </form>
    )
}
