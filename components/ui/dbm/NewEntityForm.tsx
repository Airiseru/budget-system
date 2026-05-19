'use client'

import { useActionState, useState } from 'react'
import { createNewEntity } from '@/src/actions/entities'
import { Button } from '@/components/ui/button'
import { Department, Agency, OperatingUnit } from '@/src/types/entities'
import SearchableComboboxField, { type SearchableComboboxOption } from './SearchableComboboxField'

type DepartmentOption = Pick<Department, 'id' | 'name'>
type AgencyOption = Pick<Agency, 'id' | 'name' | 'department_id'>
type OperatingUnitOption = Pick<OperatingUnit, 'id' | 'name' | 'agency_id'>

type Props = {
    canCreate: {
        department: boolean
        agency: boolean
        operating_unit: boolean
    };
    departments: DepartmentOption[]
    agencies: AgencyOption[]
    operatingUnits: OperatingUnitOption[]
}

const entityTypeLabels: Record<string, string> = {
    department: 'Department',
    agency: 'Agency',
    operating_unit: 'Operating Unit',
}

const agencyTypeLabels: Record<string, string> = {
    bureau: 'Bureau',
    attached_agency: 'Attached Agency',
}

const entityNamePlaceholders: Record<string, string> = {
    department: "Department of Budget and Management",
    agency: "Office of the Secretary",
    operating_unit: "Central Office",
}

const entityUacsCodePlaceholders: Record<string, string> = {
    department: "01",
    agency: "001",
    operating_unit: "01",
}

const entityAbbrPlaceholders: Record<string, string> = {
    department: "DBM",
    agency: "PhilFIDA",
    operating_unit: "CO",
}

export function NewEntityForm({ canCreate, departments, agencies, operatingUnits }: Props) {
    const [state, action, pending] = useActionState(createNewEntity, undefined)
    
    const [entityType, setEntityType] = useState<string>('')
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')
    const [selectedAgencyType, setSelectedAgencyType] = useState<string>('')
    const [selectedAgencyId, setSelectedAgencyId] = useState<string>('')
    const [selectedParentOuId, setSelectedParentOuId] = useState<string>('')

    // Wipes ALL dependent states when the main entity type changes
    const handleEntityChange = (value: string | null) => {
        setEntityType(value ?? '')
        setSelectedDepartmentId('')
        setSelectedAgencyType('')
        setSelectedAgencyId('')
        setSelectedParentOuId('')
    }

    const handleDepartmentChange = (value: string | null) => {
        setSelectedDepartmentId(value ?? '')
        setSelectedAgencyId('')
        setSelectedParentOuId('')
    }

    const handleAgencyTypeChange = (value: string | null) => {
        setSelectedAgencyType(value ?? '')
        setSelectedAgencyId('')
    }

    const handleAgencyIdChange = (value: string | null) => {
        setSelectedAgencyId(value ?? '')
        setSelectedParentOuId('')
    }

    const handleParentOuChange = (value: string | null) => {
        setSelectedParentOuId(value === 'none' || !value ? '' : value)
    }

    const availableTypes = Object.entries(canCreate)
        .filter(([, can]) => can)
        .map(([type]) => type)
    const entityTypeOptions: SearchableComboboxOption[] = availableTypes.map((type) => ({
        value: type,
        label: entityTypeLabels[type],
    }))
    const agencyTypeOptions: SearchableComboboxOption[] = Object.entries(agencyTypeLabels).map(([value, label]) => ({
        value,
        label,
    }))
    const departmentOptions: SearchableComboboxOption[] = departments.map((department) => ({
        value: department.id,
        label: department.name,
    }))

    // Filter agencies based on the selected department (for cleaner UI)
    const filteredAgencies = selectedDepartmentId 
        ? agencies.filter(a => a?.department_id === selectedDepartmentId)
        : agencies
    const agencyOptions: SearchableComboboxOption[] = filteredAgencies.map((agency) => ({
        value: agency.id,
        label: agency.name,
    }))

    const filteredOperatingUnits = selectedAgencyId
        ? operatingUnits.filter(ou => ou?.agency_id === selectedAgencyId)
        : []
    const parentOuOptions: SearchableComboboxOption[] = [
        { value: 'none', label: 'Top-level OU under the selected agency' },
        ...filteredOperatingUnits.map((ou) => ({
            value: ou.id,
            label: ou.name,
        })),
    ]

    return (
        <form action={action} className="space-y-6 border border-border rounded-lg p-6">
            {(state?.formErrors && state.formErrors.length > 0) && (
                <p className="text-red-500 text-sm italic">{state.formErrors[0]}</p>
            )}

            {/* Entity Type Selector */}
            <div className="space-y-2">
                <label htmlFor="entity_type" className="font-medium">Entity Type to Create</label>
                <input id="entity_type" type="hidden" name="entity_type" value={entityType} />
                <SearchableComboboxField
                    items={entityTypeOptions}
                    value={entityType}
                    onValueChange={handleEntityChange}
                    placeholder="Select entity type"
                    searchPlaceholder="Search entity types"
                    emptyText="No entity types found."
                />
            </div>

            {entityType && (
                <div key={entityType} className="space-y-6 animate-in fade-in slide-in-from-top-2">

                    {/* Department Selector for National type */}
                    {((entityType === 'agency' || entityType === 'operating_unit') && canCreate.department) && (
                        <div className="space-y-2">
                            <label htmlFor="department_id" className="font-medium">Under Department</label>
                            <input type="hidden" name="department_id" value={selectedDepartmentId} />
                            <SearchableComboboxField
                                items={departmentOptions}
                                value={selectedDepartmentId}
                                onValueChange={handleDepartmentChange}
                                placeholder="Select parent department (Leave blank if Independent)"
                                searchPlaceholder="Search departments"
                                emptyText="No departments found."
                            />
                        </div>
                    )}

                    {/* Agency Type — only for Agency */}
                    {entityType === 'agency' && (
                        <div className="space-y-2">
                            <label htmlFor="type" className="font-medium">Agency Type</label>
                            <input id="type" type="hidden" name="type" value={selectedAgencyType} />
                            <SearchableComboboxField
                                items={agencyTypeOptions}
                                value={selectedAgencyType}
                                onValueChange={handleAgencyTypeChange}
                                placeholder="Select agency type"
                                searchPlaceholder="Search agency types"
                                emptyText="No agency types found."
                            />
                        </div>
                    )}

                    {/* Agency Selector — only for Operating Unit */}
                    {(entityType === 'operating_unit' && (canCreate.department || canCreate.agency)) && (
                        <>
                            <div className="space-y-2">
                                <label htmlFor='agency_id' className="font-medium">Under Agency</label>
                                <input id="agency_id" type="hidden" name="agency_id" value={selectedAgencyId} />
                                <SearchableComboboxField
                                    items={agencyOptions}
                                    value={selectedAgencyId}
                                    onValueChange={handleAgencyIdChange}
                                    placeholder="Select agency"
                                    searchPlaceholder="Search agencies"
                                    emptyText="No agencies found."
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor='parent_ou_id' className="font-medium">Parent Operating Unit</label>
                                <input id="parent_ou_id" type="hidden" name="parent_ou_id" value={selectedParentOuId} />
                                <SearchableComboboxField
                                    items={parentOuOptions}
                                    value={selectedParentOuId || 'none'}
                                    onValueChange={handleParentOuChange}
                                    disabled={!selectedAgencyId}
                                    placeholder="Optional: choose a parent operating unit for a lower-level OU"
                                    searchPlaceholder="Search operating units"
                                    emptyText="No operating units found."
                                />
                            </div>
                        </>
                    )}
                    
                    {/* Name, Abbreviation, UACS Inputs */}
                    <div className="space-y-2">
                        <label htmlFor="name" className="font-medium">Name</label>
                        <input id="name" name="name" defaultValue={state?.values?.name ?? ''} className="border border-border px-3 py-2 my-1 w-full rounded bg-background" placeholder={entityNamePlaceholders[entityType]} required autoComplete="off" />
                        {state?.fieldErrors?.name && (
                            <p className="text-red-500 text-sm italic">{state.fieldErrors.name[0]}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="abbr" className="font-medium">Abbreviation</label>
                        <input id="abbr" name="abbr" defaultValue={state?.values?.abbr ?? ''} className="border border-border px-3 py-2 my-1 w-full rounded bg-background" placeholder={entityAbbrPlaceholders[entityType]} autoComplete="off" />
                        {state?.fieldErrors?.abbr && (
                            <p className="text-red-500 text-sm italic">{state.fieldErrors.abbr[0]}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="uacs_code" className="font-medium">UACS Code</label>
                        <input
                            id="uacs_code"
                            name="uacs_code"
                            defaultValue={state?.values?.uacs_code ?? ''}
                            className="border border-border px-3 py-2 my-1 w-full rounded bg-background font-mono"
                            placeholder={entityType === 'operating_unit' && selectedParentOuId ? '00001' : entityUacsCodePlaceholders[entityType]}
                            required
                            autoComplete="off"
                        />
                        {entityType === 'operating_unit' && (
                            <p className="text-xs text-muted-foreground">
                                {selectedParentOuId
                                    ? 'Lower-level operating units must use a 5-digit UACS Code.'
                                    : 'Top-level operating units must use a 2-digit UACS Code.'}
                            </p>
                        )}
                        {state?.fieldErrors?.uacs_code && (
                            <p className="text-red-500 text-sm italic">{state.fieldErrors.uacs_code[0]}</p>
                        )}
                    </div>

                    <Button type="submit" disabled={pending} className="w-full py-5 text-md bg-accent-foreground text-white">
                        {pending ? 'Creating...' : `Create ${entityTypeLabels[entityType]}`}
                    </Button>
                </div>
            )}
        </form>
    )
}
