'use client'

import { useActionState, useMemo, useState } from 'react'
import { createEntityRequestAction } from '@/src/actions/entities'
import { Department, Agency, OperatingUnit } from '@/src/types/entities'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ENTITY_TYPE_LABELS } from '@/src/lib/constants'

type DepartmentOption = Pick<Department, 'id' | 'name'>
type AgencyOption = Pick<Agency, 'id' | 'name' | 'department_id'>
type OperatingUnitOption = Pick<OperatingUnit, 'id' | 'name' | 'agency_id'>

type Props = {
    requesterType: string | null | undefined
    requesterEntityId: string
    departments: DepartmentOption[]
    agencies: AgencyOption[]
    operatingUnits: OperatingUnitOption[]
    fixedDepartmentId?: string
    fixedAgencyId?: string
}

export function EntityRequestForm({
    requesterType,
    requesterEntityId,
    departments,
    agencies,
    operatingUnits,
    fixedDepartmentId,
    fixedAgencyId,
}: Props) {
    const [state, action, pending] = useActionState(createEntityRequestAction, undefined)
    const [classification, setClassification] = useState(state?.values?.proposed_classification ?? '')
    const [parentDepartmentId, setParentDepartmentId] = useState(state?.values?.proposed_parent_department_id ?? fixedDepartmentId ?? '')
    const [parentAgencyId, setParentAgencyId] = useState(state?.values?.proposed_parent_agency_id ?? fixedAgencyId ?? '')
    const [parentOuId, setParentOuId] = useState(state?.values?.proposed_parent_ou_id ?? '')
    const [agencyType, setAgencyType] = useState(state?.values?.proposed_agency_type ?? '')

    const availableTypes = useMemo(() => {
        if (requesterType === 'national') return ['department', 'agency', 'operating_unit']
        if (requesterType === 'department') return ['agency', 'operating_unit']
        if (requesterType === 'agency') return ['operating_unit']
        if (requesterType === 'operating_unit') return ['operating_unit']
        return ['agency', 'operating_unit']
    }, [requesterType])

    const selectableDepartments = requesterType === 'department'
        ? departments.filter(department => department?.id === requesterEntityId)
        : departments

    const selectableAgencies = requesterType === 'agency'
        ? agencies.filter(agency => agency?.id === requesterEntityId)
        : parentDepartmentId
            ? agencies.filter(agency => agency?.department_id === parentDepartmentId)
            : agencies

    const selectableParentOus = parentAgencyId
        ? operatingUnits.filter(ou => ou?.agency_id === parentAgencyId)
        : requesterType === 'operating_unit'
            ? operatingUnits.filter(ou => ou?.id === requesterEntityId)
            : []

    return (
        <form action={action} className="space-y-6 border border-border rounded-lg p-6">
            {state?.formErrors?.[0] && (
                <p className="text-red-500 text-sm italic">{state.formErrors[0]}</p>
            )}

            <div className="space-y-2">
                <label className="font-medium">Requested Entity Type</label>
                <input type="hidden" name="proposed_classification" value={classification} />
                <Select value={classification} onValueChange={(value) => {
                    setClassification(value ?? '')
                    setParentDepartmentId(fixedDepartmentId ?? '')
                    setParentAgencyId(fixedAgencyId ?? '')
                    setParentOuId('')
                    setAgencyType('')
                }}>
                    <SelectTrigger className="border border-border px-3 py-2 my-1 w-full rounded bg-background">
                        <SelectValue placeholder="Select entity type">
                            {classification ? ENTITY_TYPE_LABELS[classification] : 'Select entity type'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {availableTypes.map(type => (
                            <SelectItem key={type} value={type}>
                                {type === 'operating_unit' ? 'Operating Unit' : type.charAt(0).toUpperCase() + type.slice(1)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {classification === 'agency' && (
                <div className="space-y-2">
                    <label className="font-medium">Agency Type</label>
                    <input type="hidden" name="proposed_agency_type" value={agencyType} />
                    <Select value={agencyType} onValueChange={(value) => setAgencyType(value ?? '')}>
                        <SelectTrigger className="border border-border px-3 py-2 my-1 w-full rounded bg-background">
                            <SelectValue placeholder="Select agency type">
                                {agencyType ? (agencyType === 'bureau' ? 'Bureau' : 'Attached Agency') : 'Select agency type'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="bureau">Bureau</SelectItem>
                            <SelectItem value="attached_agency">Attached Agency</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-2">
                <label className="font-medium">Name</label>
                <input name="proposed_name" defaultValue={state?.values?.proposed_name ?? ''} className="border border-border px-3 py-2 my-1 w-full rounded bg-background" required />
            </div>

            <div className="space-y-2">
                <label className="font-medium">Abbreviation</label>
                <input name="proposed_abbr" defaultValue={state?.values?.proposed_abbr ?? ''} className="border border-border px-3 py-2 my-1 w-full rounded bg-background" />
            </div>

            {(classification === 'agency' || classification === 'operating_unit') && (
                <div className="space-y-2">
                    <label className="font-medium">Parent Department</label>
                    <input type="hidden" name="proposed_parent_department_id" value={parentDepartmentId} />
                    <Select value={parentDepartmentId} onValueChange={(value) => {
                        setParentDepartmentId(value ?? '')
                        setParentAgencyId(fixedAgencyId ?? '')
                        setParentOuId('')
                    }} disabled={!!fixedDepartmentId}>
                        <SelectTrigger className="border border-border px-3 py-2 my-1 w-full rounded bg-background">
                            <SelectValue placeholder="Select parent department">
                                {parentDepartmentId ? selectableDepartments.find(department => department?.id === parentDepartmentId)?.name : 'Select parent department'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {selectableDepartments.map(department => department && (
                                <SelectItem key={department.id} value={department.id}>
                                    {department.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {classification === 'operating_unit' && (
                <>
                    <div className="space-y-2">
                        <label className="font-medium">Parent Agency</label>
                        <input type="hidden" name="proposed_parent_agency_id" value={parentAgencyId} />
                        <Select value={parentAgencyId} onValueChange={(value) => {
                            setParentAgencyId(value ?? '')
                            setParentOuId('')
                        }} disabled={!!fixedAgencyId}>
                            <SelectTrigger className="border border-border px-3 py-2 my-1 w-full rounded bg-background">
                                <SelectValue placeholder="Select parent agency">
                                    {parentAgencyId ? selectableAgencies.find(agency => agency?.id === parentAgencyId)?.name : 'Select parent agency'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {selectableAgencies.map(agency => agency && (
                                    <SelectItem key={agency.id} value={agency.id}>
                                        {agency.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="font-medium">Parent Operating Unit</label>
                        <input type="hidden" name="proposed_parent_ou_id" value={parentOuId} />
                        <Select value={parentOuId || 'none'} onValueChange={(value) => setParentOuId(value === 'none' ? '' : value ?? '')} disabled={!parentAgencyId && !fixedAgencyId && requesterType !== 'operating_unit'}>
                            <SelectTrigger className="border border-border px-3 py-2 my-1 w-full rounded bg-background">
                                <SelectValue placeholder="Optional: select a parent operating unit">
                                    {parentOuId ? selectableParentOus.find(ou => ou?.id === parentOuId)?.name : 'Optional: select a parent operating unit'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Top-level OU</SelectItem>
                                {selectableParentOus.map(ou => ou && (
                                    <SelectItem key={ou.id} value={ou.id}>
                                        {ou.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </>
            )}

            <div className="space-y-2">
                <label className="font-medium">Legal Basis</label>
                <textarea
                    name="legal_basis"
                    defaultValue={state?.values?.legal_basis ?? ''}
                    className="border border-border px-3 py-2 w-full rounded bg-background min-h-28 resize-y my-1"
                    placeholder="Republic Act, Executive Order, board resolution, or other basis"
                    required
                />
            </div>

            <Button type="submit" disabled={pending} className="w-full py-5 text-md bg-accent-foreground text-white">
                {pending ? 'Submitting Request...' : 'Submit Entity Request'}
            </Button>
        </form>
    )
}
