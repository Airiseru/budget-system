'use client'

import { useActionState, useState } from 'react'
import { updateEntity } from '@/src/actions/entities'
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
    entityType: 'department' | 'agency' | 'operating_unit'
    entity: any
    departments: Partial<Department[]>
    agencies: Partial<Agency[]>
}

const agencyTypeLabels: Record<string, string> = {
    bureau: 'Bureau',
    attached_agency: 'Attached Agency',
}

export function EditEntityForm({ canCreate, entityType, entity, departments, agencies }: Props) {
    const [state, action, pending] = useActionState(updateEntity, undefined)
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(entity.department_id || '')
    const [selectedAgencyType, setSelectedAgencyType] = useState<string>(entity.type || '')
    const [selectedAgencyId, setSelectedAgencyId] = useState<string>(entity.agency_id || '')

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

    // Filter agencies by selected department
    const filteredAgencies = selectedDepartmentId 
        ? agencies.filter(a => a?.department_id === selectedDepartmentId)
        : agencies

    return (
        <form action={action} className="space-y-6 border border-border rounded-lg p-6">
            {(state?.formErrors && state.formErrors.length > 0) && (
                <p className="text-red-500 text-sm italic">{state.formErrors[0]}</p>
            )}

            {/* Hidden identifiers sent to the Server Action */}
            <input type="hidden" name="entity_id" value={entity.id} />
            <input type="hidden" name="entity_type" value={entityType} />

            <div className="space-y-2">
                <label htmlFor="name" className="font-medium">Name</label>
                <input
                    id="name"
                    name="name"
                    defaultValue={state?.values?.name ?? entity.name}
                    className="border border-border px-3 py-2 my-1 w-full rounded bg-background"
                    required
                    autoComplete="off"
                />
                {state?.fieldErrors?.name && (
                    <p className="text-red-500 text-sm italic">{state.fieldErrors.name}</p>
                )}
            </div>

            <div className="space-y-2">
                <label htmlFor="uacs_code" className="font-medium">UACS Code</label>
                <input
                    id="uacs_code"
                    name="uacs_code"
                    defaultValue={state?.values?.uacs_code ?? entity.uacs_code}
                    className="border border-border px-3 py-2 my-1 w-full rounded bg-background font-mono"
                    required
                    autoComplete="off"
                />
                {state?.fieldErrors?.uacs_code && (
                    <p className="text-red-500 text-sm italic">{state.fieldErrors.uacs_code}</p>
                )}
            </div>

            {/* Agency-Specific Fields */}
            {((entityType === 'agency' || entityType === 'operating_unit') && canCreate.department) && (
                <div className="space-y-2">
                    <label htmlFor="department_id" className="font-medium">Under Department</label>
                    <input type="hidden" name="department_id" value={selectedDepartmentId} />
                    <Select
                        value={selectedDepartmentId}
                        onValueChange={handleDepartmentChange}
                    >
                        <SelectTrigger className="border px-3 py-5 my-1 w-full rounded border-border text-base bg-background">
                            <SelectValue placeholder="Select parent department (Leave blank if Independent)">
                                {selectedDepartmentId ? departments.find(d => d?.id === selectedDepartmentId)?.name : 'Independent / No Department'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Independent / No Department</SelectItem>
                            {departments.map(dept => (
                                <SelectItem key={dept?.id} value={dept?.id}>{dept?.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Agency Type */}
            {entityType === "agency" && (
                <div className="space-y-2">
                    <label htmlFor="type" className="font-medium">Agency Type</label>
                    <input id="type" type="hidden" name="type" value={selectedAgencyType} />
                    <Select
                        value={selectedAgencyType}
                        onValueChange={handleAgencyTypeChange}
                    >
                        <SelectTrigger className="border px-3 py-5 my-1 w-full rounded border-border text-base bg-background">
                            <SelectValue placeholder="Select agency type">
                                {selectedAgencyType ? agencyTypeLabels[selectedAgencyType] : 'Select Agency Type'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="bureau">Bureau</SelectItem>
                            <SelectItem value="attached_agency">Attached Agency</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Operating Unit-Specific Fields */}
            {(entityType === 'operating_unit' && (canCreate.department || canCreate.agency)) && (
                <div className="space-y-2">
                    <label htmlFor="agency_id" className="font-medium">Under Agency</label>
                    <input id="agency_id" type="hidden" name="agency_id" value={selectedAgencyId} />
                    <Select
                        value={selectedAgencyId}
                        onValueChange={handleAgencyIdChange}
                    >
                        <SelectTrigger className="border px-3 py-5 my-1 w-full rounded border-border text-base bg-background">
                            <SelectValue placeholder="Select parent agency">
                                {selectedAgencyId ? agencies.find(a => a?.id === selectedAgencyId)?.name : 'Select Parent Agency'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {filteredAgencies.map(agency => (
                                <SelectItem key={agency?.id} value={agency?.id}>{agency?.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <Button type="submit" disabled={pending} className="w-full py-5 text-md bg-accent-foreground text-white border border-accent-foreground hover:bg-accent-foreground/90">
                {pending ? 'Saving Changes...' : 'Save Changes'}
            </Button>
        </form>
    )
}