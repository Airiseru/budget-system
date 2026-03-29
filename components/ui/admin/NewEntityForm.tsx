'use client'

import { useActionState, useState } from 'react'
import { createNewEntity } from '@/src/actions/entities'
import { Button } from '@/components/ui/button'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Department, Agency } from '@/src/types/entities'

type Props = {
    canCreate: {
        department: boolean
        agency: boolean
        operating_unit: boolean
    };
    departments: Partial<Department[]>
    agencies: Partial<Agency[]>
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

export function NewEntityForm({ canCreate, departments, agencies }: Props) {
    const [state, action, pending] = useActionState(createNewEntity, undefined)
    
    const [entityType, setEntityType] = useState<string>('')
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')
    const [selectedAgencyType, setSelectedAgencyType] = useState<string>('')
    const [selectedAgencyId, setSelectedAgencyId] = useState<string>('')

    // Wipes ALL dependent states when the main entity type changes
    const handleEntityChange = (value: string | null) => {
        setEntityType(value ?? '')
        setSelectedDepartmentId('')
        setSelectedAgencyType('')
        setSelectedAgencyId('')
    }

    const handleDepartmentChange = (value: string | null) => {
        setSelectedDepartmentId(value ?? '')
        setSelectedAgencyId('') 
    }

    const handleAgencyTypeChange = (value: string | null) => {
        setSelectedAgencyType(value ?? '')
        setSelectedAgencyId('')
    }

    const handleAgencyIdChange = (value: string | null) => {
        setSelectedAgencyId(value ?? '')
    }

    const availableTypes = Object.entries(canCreate)
        .filter(([_, can]) => can)
        .map(([type]) => type)

    // Filter agencies based on the selected department (for cleaner UI)
    const filteredAgencies = selectedDepartmentId 
        ? agencies.filter(a => a?.department_id === selectedDepartmentId)
        : agencies

    return (
        <form action={action} className="space-y-6 border border-border rounded-lg p-6">
            {state?.formErrors && (
                <p className="text-red-500 text-sm italic">{state.formErrors[0]}</p>
            )}

            {/* Entity Type Selector */}
            <div className="space-y-2">
                <label htmlFor="entity_type" className="font-medium">Entity Type to Create</label>
                <input id="entity_type" type="hidden" name="entity_type" value={entityType} />
                <Select value={entityType} onValueChange={handleEntityChange}>
                    <SelectTrigger className="border px-3 py-5 w-full rounded my-1 border-border text-base bg-background">
                        <SelectValue placeholder="Select entity type">
                            {entityType ? entityTypeLabels[entityType] : 'Select entity type'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {availableTypes.map(type => (
                            <SelectItem key={type} value={type}>
                                {entityTypeLabels[type]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {entityType && (
                <div key={entityType} className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    
                    {/* Name & UACS Inputs ... (Keep these exactly the same as your code) */}
                    <div className="space-y-2">
                        <label htmlFor="name" className="font-medium">Name</label>
                        <input id="name" name="name" defaultValue={state?.values?.name ?? ''} className="border border-border px-3 py-2 my-1 w-full rounded bg-background" placeholder={entityNamePlaceholders[entityType]} required autoComplete="off" />
                        {state?.fieldErrors?.name && (
                            <p className="text-red-500 text-sm italic">{state.fieldErrors.name[0]}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="uacs_code" className="font-medium">UACS Code</label>
                        <input id="uacs_code" name="uacs_code" defaultValue={state?.values?.uacs_code ?? ''} className="border border-border px-3 py-2 my-1 w-full rounded bg-background font-mono" placeholder={entityUacsCodePlaceholders[entityType]} required autoComplete="off" />
                        {state?.fieldErrors?.uacs_code && (
                            <p className="text-red-500 text-sm italic">{state.fieldErrors.uacs_code[0]}</p>
                        )}
                    </div>

                    {/* Department Selector  for National type */}
                    {((entityType === 'agency' || entityType === 'operating_unit') && canCreate.department) && (
                        <div className="space-y-2">
                            <label htmlFor="department_id" className="font-medium">Under Department</label>
                            <input type="hidden" name="department_id" value={selectedDepartmentId} />
                            <Select value={selectedDepartmentId} onValueChange={handleDepartmentChange}>
                                <SelectTrigger className="border px-3 py-5 w-full rounded my-1 border-border text-base bg-background">
                                    <SelectValue placeholder="Select parent department (Leave blank if Independent)">
                                        {selectedDepartmentId ? departments.find(d => d?.id === selectedDepartmentId)?.name : 'Select parent department (Leave blank if Independent)'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map(dept => (
                                        <SelectItem key={dept?.id} value={dept?.id}>
                                            {dept?.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Agency Type — only for Agency */}
                    {entityType === 'agency' && (
                        <div className="space-y-2">
                            <label htmlFor="type" className="font-medium">Agency Type</label>
                            <input id="type" type="hidden" name="type" value={selectedAgencyType} />
                            <Select value={selectedAgencyType} onValueChange={handleAgencyTypeChange}>
                                <SelectTrigger className="border px-3 py-5 w-full rounded my-1 border-border text-base bg-background">
                                    <SelectValue placeholder="Select agency type">
                                        {selectedAgencyType ? agencyTypeLabels[selectedAgencyType] : 'Select agency type'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bureau">Bureau</SelectItem>
                                    <SelectItem value="attached_agency">Attached Agency</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Agency Selector — only for Operating Unit */}
                    {(entityType === 'operating_unit' && (canCreate.department || canCreate.agency)) && (
                        <div className="space-y-2">
                            <label htmlFor='agency_id' className="font-medium">Under Agency</label>
                            <input id="agency_id" type="hidden" name="agency_id" value={selectedAgencyId} />
                            <Select value={selectedAgencyId} onValueChange={handleAgencyIdChange} disabled={!selectedDepartmentId && filteredAgencies.length > 50}>
                                <SelectTrigger className="border px-3 py-5 w-full rounded my-1 border-border text-base bg-background">
                                    <SelectValue placeholder="Select parent agency">
                                        {selectedAgencyId
                                            ? agencies.find(a => a?.id === selectedAgencyId)?.name
                                            : 'Select agency'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredAgencies.map(agency => (
                                        <SelectItem key={agency?.id} value={agency?.id}>
                                            {agency?.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <Button type="submit" disabled={pending} className="w-full py-5 text-md bg-accent-foreground text-white">
                        {pending ? 'Creating...' : `Create ${entityTypeLabels[entityType]}`}
                    </Button>
                </div>
            )}
        </form>
    )
}