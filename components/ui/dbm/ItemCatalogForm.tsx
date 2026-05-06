'use client'

import { useActionState, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    createItemCatalogAction,
    updateItemCatalogAction,
} from '@/src/actions/items'
import {
    ITEM_EXPENSE_CLASS_OPTIONS,
    ITEM_SCOPE_OPTIONS,
} from '@/src/lib/constants'
import type { ItemFormState } from '@/src/lib/validations/items'
import type { ItemCatalogScope } from '@/src/types/line_items'
import type { UacsObjectCode } from '@/src/types/uacs'

type EntityOption = {
    id: string
    name: string
    abbr: string | null
    entity_type: string
    department_id?: string | null
    agency_id?: string | null
    parent_ou_id?: string | null
}

type PapOption = {
    id: string
    title: string
    entity_id: string | null
    entity_name: string | null
}

type ItemRecordValues = {
    id?: string
    scope?: string | null
    entity_id?: string | null
    pap_code?: string | null
    uacs_obj_code?: string | null
    name?: string | null
    description?: string | null
    expense_class?: string | null
    expense_class_code?: string | null
    unit_of_measure?: string | null
}

type Props = {
    mode: 'create' | 'edit'
    entities: EntityOption[]
    paps: PapOption[]
    objectCodes: UacsObjectCode[]
    initialValues?: ItemRecordValues
}

const EMPTY_STATE: ItemFormState = undefined

export function ItemCatalogForm({ mode, entities, paps, objectCodes, initialValues }: Props) {
    const actionFn = mode === 'create' ? createItemCatalogAction : updateItemCatalogAction
    const [state, action, pending] = useActionState(actionFn, EMPTY_STATE)

    const formKey = JSON.stringify({
        id: initialValues?.id ?? '',
        values: state?.values ?? null,
    })

    return (
        <ItemCatalogFormBody
            key={formKey}
            mode={mode}
            entities={entities}
            paps={paps}
            objectCodes={objectCodes}
            initialValues={initialValues}
            state={state}
            action={action}
            pending={pending}
        />
    )
}

type FormBodyProps = Props & {
    state: ItemFormState
    action: (payload: FormData) => void
    pending: boolean
}

function ItemCatalogFormBody({
    mode,
    entities,
    paps,
    objectCodes,
    initialValues,
    state,
    action,
    pending,
}: FormBodyProps) {

    const [scope, setScope] = useState<ItemCatalogScope>((state?.values?.scope as ItemCatalogScope | undefined) ?? (initialValues?.scope as ItemCatalogScope | undefined) ?? 'global')
    const [entityId, setEntityId] = useState(state?.values?.entity_id ?? initialValues?.entity_id ?? '')
    const [papCode, setPapCode] = useState(state?.values?.pap_code ?? initialValues?.pap_code ?? '')
    const [expenseClass, setExpenseClass] = useState(state?.values?.expense_class ?? initialValues?.expense_class ?? ITEM_EXPENSE_CLASS_OPTIONS[0]?.value ?? 'PS')
    const [uacsObjCode, setUacsObjCode] = useState(state?.values?.uacs_obj_code ?? initialValues?.uacs_obj_code ?? '')
    const [createNewObjectCode, setCreateNewObjectCode] = useState(state?.values?.create_new_object_code === 'on')
    const [newObjectDescription, setNewObjectDescription] = useState(state?.values?.new_object_description ?? '')
    const [newChartAccountCode, setNewChartAccountCode] = useState(state?.values?.new_chart_account_code ?? '')
    const [newChartAccountDesc, setNewChartAccountDesc] = useState(state?.values?.new_chart_account_desc ?? '')
    const [newSubObjectCode, setNewSubObjectCode] = useState(state?.values?.new_sub_object_code ?? '')
    const [newSubObjectDesc, setNewSubObjectDesc] = useState(state?.values?.new_sub_object_desc ?? '')
    const [newObjectStatus, setNewObjectStatus] = useState<'active' | 'inactive'>((state?.values?.new_object_status as 'active' | 'inactive' | undefined) ?? 'active')

    const handleEntityChange = (value: string | null) => {
        setEntityId(value ?? '')
    }

    const handlePapChange = (value: string | null) => {
        setPapCode(value ?? '')
    }

    const handleUacsObjCodeChange = (value: string | null) => {
        setUacsObjCode(value ?? '')
    }

    const handleStatusChange = (value: string | null) => {
        setNewObjectStatus((value as 'active' | 'inactive') ?? 'active' )
    }

    const derivedExpenseClassCode = useMemo(
        () => ITEM_EXPENSE_CLASS_OPTIONS.find((option) => option.value === expenseClass)?.code ?? '1',
        [expenseClass]
    )

    const departments = useMemo(
        () => entities.filter((entity) => entity.entity_type === 'department'),
        [entities]
    )

    const agencies = useMemo(
        () => entities.filter((entity) => entity.entity_type === 'agency'),
        [entities]
    )

    const operatingUnits = useMemo(
        () => entities.filter((entity) => entity.entity_type === 'operating_unit'),
        [entities]
    )

    const independentAgencies = useMemo(
        () => agencies.filter((agency) => agency.department_id == null),
        [agencies]
    )

    const getEntityDisplayName = (id: string) => {
        const department = departments.find((entity) => entity.id === id)
        if (department) return department.name

        const agency = agencies.find((entity) => entity.id === id)
        if (agency) return agency.name

        const operatingUnit = operatingUnits.find((entity) => entity.id === id)
        if (operatingUnit) return operatingUnit.name

        return ''
    }

    const selectedPap = useMemo(
        () => paps.find((pap) => pap.id === papCode) ?? null,
        [papCode, paps]
    )

    const fieldErrors = state?.fieldErrors ?? {}

    return (
        <form action={action} className="space-y-6 border border-border rounded-lg p-6 bg-background">
            {mode === 'edit' && (
                <input type="hidden" name="id" value={initialValues?.id ?? ''} />
            )}

            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="entity_id" value={scope === 'entity' ? entityId : ''} />
            <input type="hidden" name="pap_code" value={scope === 'pap' ? papCode : ''} />
            <input type="hidden" name="expense_class" value={expenseClass} />
            <input type="hidden" name="expense_class_code" value={derivedExpenseClassCode} />
            <input type="hidden" name="uacs_obj_code" value={createNewObjectCode ? '' : uacsObjCode} />
            <input type="hidden" name="new_object_status" value={newObjectStatus} />

            {state?.formErrors && state.formErrors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.formErrors[0]}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                    <label className="font-medium">Scope</label>
                    <Select value={scope} onValueChange={(value) => setScope((value as ItemCatalogScope | undefined) ?? 'global')}>
                        <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background my-1">
                            <SelectValue placeholder="Select scope">
                                {ITEM_SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? 'Select scope'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {ITEM_SCOPE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {fieldErrors.scope && <p className="text-red-500 text-sm italic">{fieldErrors.scope[0]}</p>}
                </div>

                <div className="space-y-2">
                    <label className="font-medium">Expense Class</label>
                    <Select value={expenseClass} onValueChange={(value) => setExpenseClass(value ?? 'PS')}>
                        <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background my-1">
                            <SelectValue placeholder="Select expense class">
                                {ITEM_EXPENSE_CLASS_OPTIONS.find((option) => option.value === expenseClass)?.label ?? 'Select expense class'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {ITEM_EXPENSE_CLASS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {fieldErrors.expense_class && <p className="text-red-500 text-sm italic">{fieldErrors.expense_class[0]}</p>}
                </div>
            </div>

            {scope === 'entity' && (
                <div className="space-y-2">
                    <label htmlFor="entity_id" className="font-medium">Entity</label>
                    <input id="entity_id" name="entity_id" value={entityId} type="hidden" />
                    <Select
                        value={entityId}
                        onValueChange={handleEntityChange}
                    >
                        <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background my-1">
                            <SelectValue placeholder="Select entity">
                                {entityId ? getEntityDisplayName(entityId) : 'Select entity'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {departments.map((department) => {
                                const childAgencies = agencies.filter((agency) => agency.department_id === department.id)

                                return (
                                    <SelectGroup key={department.id}>
                                        <SelectLabel className="bg-muted/50">{department.name}</SelectLabel>

                                        <SelectItem value={department.id}>
                                            {department.name}
                                        </SelectItem>

                                        {childAgencies.map((agency) => (
                                            <div key={agency.id}>
                                                <SelectItem value={agency.id}>
                                                    {agency.name}
                                                </SelectItem>
                                                {operatingUnits
                                                    .filter((operatingUnit) => operatingUnit.agency_id === agency.id)
                                                    .map((operatingUnit) => (
                                                        <SelectItem key={operatingUnit.id} value={operatingUnit.id}>
                                                            {`↳ ${operatingUnit.name}`}
                                                        </SelectItem>
                                                    ))}
                                            </div>
                                        ))}
                                    </SelectGroup>
                                )
                            })}

                            {independentAgencies.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel className="bg-muted/50">Independent Agencies & SUCs</SelectLabel>
                                    {independentAgencies.map((agency) => (
                                        <div key={agency.id}>
                                            <SelectItem value={agency.id}>
                                                {agency.name}
                                            </SelectItem>
                                            {operatingUnits
                                                .filter((operatingUnit) => operatingUnit.agency_id === agency.id)
                                                .map((operatingUnit) => (
                                                    <SelectItem key={operatingUnit.id} value={operatingUnit.id}>
                                                        {`↳ ${operatingUnit.name}`}
                                                    </SelectItem>
                                                ))}
                                        </div>
                                    ))}
                                </SelectGroup>
                            )}
                        </SelectContent>
                    </Select>
                    {fieldErrors.entity_id && <p className="text-red-500 text-sm italic">{fieldErrors.entity_id[0]}</p>}
                </div>
            )}

            {scope === 'pap' && (
                <div className="space-y-2">
                    <label htmlFor="pap_code" className="font-medium">PAP</label>
                    <input id="pap_code" name="pap_code" value={papCode} type="hidden" />
                    <Select
                        value={papCode}
                        onValueChange={handlePapChange}
                    >
                        <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background">
                            <SelectValue placeholder="Select PAP">
                                {paps.find((pap) => pap.id === papCode)?.title ?? 'Select PAP'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {paps.map((pap) => (
                                <SelectItem key={pap.id} value={pap.id}>
                                    {pap.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedPap && (
                        <p className="text-xs text-muted-foreground">
                            Implementing entity: {selectedPap.entity_name || 'Unassigned'}
                        </p>
                    )}
                    {fieldErrors.pap_code && <p className="text-red-500 text-sm italic">{fieldErrors.pap_code[0]}</p>}
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="name" className="font-medium">Item Name</label>
                <input
                    id="name"
                    name="name"
                    defaultValue={state?.values?.name ?? initialValues?.name ?? ''}
                    className="border border-border px-3 py-2 w-full rounded bg-background"
                    placeholder="Salaries and Wages - Regular"
                    required
                />
                {fieldErrors.name && <p className="text-red-500 text-sm italic">{fieldErrors.name[0]}</p>}
            </div>

            <div className="space-y-2">
                <label htmlFor="description" className="font-medium">Description</label>
                <textarea
                    id="description"
                    name="description"
                    defaultValue={state?.values?.description ?? initialValues?.description ?? ''}
                    className="border border-border px-3 py-2 w-full rounded bg-background min-h-24 resize-y"
                    placeholder="Optional notes for how this item should be used."
                />
                {fieldErrors.description && <p className="text-red-500 text-sm italic">{fieldErrors.description[0]}</p>}
            </div>

            <div className="space-y-2">
                <label htmlFor="unit_of_measure" className="font-medium">Unit of Measure</label>
                <input
                    id="unit_of_measure"
                    name="unit_of_measure"
                    defaultValue={state?.values?.unit_of_measure ?? initialValues?.unit_of_measure ?? ''}
                    className="border border-border px-3 py-2 w-full rounded bg-background"
                    placeholder="Optional, e.g. item, month, package"
                />
                {fieldErrors.unit_of_measure && <p className="text-red-500 text-sm italic">{fieldErrors.unit_of_measure[0]}</p>}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-4">
                {/* <div className="flex items-start justify-between gap-4"> */}
                    <div>
                        <h2 className="font-semibold text-secondary-foreground">Object Code</h2>
                        <p className="text-sm text-muted-foreground">
                            Link this item to an existing object code, or create a new one while saving the item.
                        </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-secondary-foreground">
                        <input
                            type="checkbox"
                            name="create_new_object_code"
                            checked={createNewObjectCode}
                            onChange={(event) => setCreateNewObjectCode(event.target.checked)}
                        />
                        Create new object code
                    </label>
                {/* </div> */}

                {!createNewObjectCode ? (
                    <div className="space-y-2">
                        <Select
                            value={uacsObjCode}
                            onValueChange={handleUacsObjCodeChange}
                        >
                            <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background">
                                <SelectValue placeholder="Select object code">
                                    {objectCodes.find((code) => code.code === uacsObjCode)?.code ?? 'Select object code'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {objectCodes.map((code) => (
                                    <SelectItem key={code.code} value={code.code}>
                                        {code.code} • {code.description}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fieldErrors.uacs_obj_code && <p className="text-red-500 text-sm italic">{fieldErrors.uacs_obj_code[0]}</p>}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                            <label htmlFor="new_object_description" className="font-medium">Object Code Description</label>
                            <input
                                id="new_object_description"
                                name="new_object_description"
                                value={newObjectDescription}
                                onChange={(event) => setNewObjectDescription(event.target.value)}
                                className="border border-border px-3 py-2 w-full rounded bg-background"
                                placeholder="General line item object code"
                            />
                            {fieldErrors.new_object_description && <p className="text-red-500 text-sm italic">{fieldErrors.new_object_description[0]}</p>}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="new_chart_account_code" className="font-medium">Chart Account Code</label>
                            <input
                                id="new_chart_account_code"
                                name="new_chart_account_code"
                                value={newChartAccountCode}
                                onChange={(event) => setNewChartAccountCode(event.target.value)}
                                className="border border-border px-3 py-2 w-full rounded bg-background font-mono"
                                placeholder="12345678"
                            />
                            {fieldErrors.new_chart_account_code && <p className="text-red-500 text-sm italic">{fieldErrors.new_chart_account_code[0]}</p>}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="new_sub_object_code" className="font-medium">Sub-object Code</label>
                            <input
                                id="new_sub_object_code"
                                name="new_sub_object_code"
                                value={newSubObjectCode}
                                onChange={(event) => setNewSubObjectCode(event.target.value)}
                                className="border border-border px-3 py-2 w-full rounded bg-background font-mono"
                                placeholder="01"
                            />
                            {fieldErrors.new_sub_object_code && <p className="text-red-500 text-sm italic">{fieldErrors.new_sub_object_code[0]}</p>}
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="new_chart_account_desc" className="font-medium">Chart Account Description</label>
                            <input
                                id="new_chart_account_desc"
                                name="new_chart_account_desc"
                                value={newChartAccountDesc}
                                onChange={(event) => setNewChartAccountDesc(event.target.value)}
                                className="border border-border px-3 py-2 w-full rounded bg-background"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="new_sub_object_desc" className="font-medium">Sub-object Description</label>
                            <input
                                id="new_sub_object_desc"
                                name="new_sub_object_desc"
                                value={newSubObjectDesc}
                                onChange={(event) => setNewSubObjectDesc(event.target.value)}
                                className="border border-border px-3 py-2 w-full rounded bg-background"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="new_object_status" className="font-medium">New Object Code Status</label>
                            <input id="new_object_status" name="new_object_status" value={newObjectStatus} type="hidden" />
                            <Select value={newObjectStatus} onValueChange={handleStatusChange}>
                                <SelectTrigger className="border px-3 py-5 w-full rounded border-border text-base bg-background">
                                    <SelectValue placeholder="Select status">
                                        {newObjectStatus === 'active' ? 'Active' : 'Inactive'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end">
                <Button type="submit" disabled={pending} className="w-full py-5 text-md bg-accent-foreground text-white">
                    {pending ? 'Saving...' : mode === 'create' ? 'Create Item' : 'Update Item'}
                </Button>
            </div>
        </form>
    )
}
