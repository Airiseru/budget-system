"use client"

import { signup } from "@/src/actions/auth"
import { useActionState, useState } from "react"
import { Department, Agency, OperatingUnit } from "@/src/types/entities"
import BackButton from "@/components/ui/BackButton"
import { Button } from "@/components/ui/button"
import SearchableComboboxField, {
    type SearchableComboboxOption,
} from "@/components/ui/dbm/SearchableComboboxField"
import { Eye, EyeOff } from 'lucide-react'

type Props = {
    departments: Department[];
    agencies: Agency[];
    operatingUnits: OperatingUnit[];
}

export default function SignUpForm({ departments, agencies, operatingUnits }: Props) {
    const [state, action, pending] = useActionState(signup, undefined)
    const [selectedEntityId, setSelectedEntityId] = useState<string>(state?.values?.entity_id || '')
    const [showPassword, setShowPassword] = useState(false)

    const independentAgencies = agencies.filter(a => a.department_id === null)

    const handleEntityChange = (value: string | null) => {
        setSelectedEntityId(value ?? '')
    }

    const orderedDepartments = [...departments].sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))
    const orderedAgencies = [...agencies].sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))
    const orderedOperatingUnits = [...operatingUnits].sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))

    const entityOptions: SearchableComboboxOption[] = []
    const pushOperatingUnits = (agencyId: string, parentOuId: string | null = null, depth = 1) => {
        const matches = orderedOperatingUnits.filter(
            (operatingUnit) =>
                operatingUnit.agency_id === agencyId &&
                (operatingUnit.parent_ou_id ?? null) === parentOuId
        )

        for (const operatingUnit of matches) {
            entityOptions.push({
                value: operatingUnit.id,
                label: `${'  '.repeat(depth)}↳ ${operatingUnit.name}`,
            })
            pushOperatingUnits(agencyId, operatingUnit.id, depth + 1)
        }
    }

    for (const department of orderedDepartments) {
        entityOptions.push({
            value: department.id,
            label: department.name,
        })

        const childAgencies = orderedAgencies.filter((agency) => agency.department_id === department.id)
        for (const agency of childAgencies) {
            entityOptions.push({
                value: agency.id,
                label: `${agency.name}`,
            })
            pushOperatingUnits(agency.id)
        }
    }

    if (independentAgencies.length > 0) {
        for (const agency of [...independentAgencies].sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))) {
            entityOptions.push({
                value: agency.id,
                label: `${agency.name}`,
            })
            pushOperatingUnits(agency.id)
        }
    }

    return (
        <div className="max-w-full p-8 flex h-screen items-center justify-center flex-col">
            <div className="max-w-lg w-full">
                <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
            </div>
            <form action={action} className="space-y-4 w-full max-w-lg">
                <div className="space-y-2">
                    <label htmlFor="name">Full Name</label>
                    <input id="name" name="name" placeholder="Full Name" defaultValue={state?.values?.name ?? ''} className="border px-3 py-2 w-full rounded my-1 placeholder-gray-400" required autoComplete="off" />
                    {state?.fieldErrors?.name && (
                        <p className="text-red-500 text-sm italic">{state.fieldErrors.name[0]}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="entity_id" className="font-medium">Government Entity</label>

                    {/* hidden input carries the actual UUID to the server action */}
                    <input id="entity_id" type="hidden" name="entity_id" value={selectedEntityId} required />

                    <SearchableComboboxField
                        items={entityOptions}
                        value={selectedEntityId}
                        onValueChange={(value) => handleEntityChange(value)}
                        placeholder="Select your Entity"
                        searchPlaceholder="Search entities"
                        emptyText="No entities found."
                    />
                    {state?.fieldErrors?.entity_id && (
                        <p className="text-red-500 text-sm italic">{state.fieldErrors.entity_id[0]}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="position">Position</label>
                    <input id="position" name="position" placeholder="Budget Officer" defaultValue={state?.values?.position ?? ''} className="border px-3 py-2 w-full rounded my-1 placeholder-gray-400" required autoComplete="off" />
                    {state?.fieldErrors?.position && (
                        <p className="text-red-500 text-sm italic">{state.fieldErrors.position[0]}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" placeholder="hello@budget.gov.ph" defaultValue={state?.values?.email ?? ''} className="border px-3 py-2 w-full rounded my-1 placeholder-gray-400" required autoComplete="off" />
                    {state?.fieldErrors?.email && (
                        <p className="text-red-500 text-sm italic">{state.fieldErrors.email[0]}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="password">Password</label>
                    <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            className="border px-3 py-2 w-full rounded my-1 pr-10"
                            required
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(prev => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {state?.fieldErrors?.password && (
                        <div className="text-red-500 text-sm italic">
                            <p>Password must:</p>
                            <ul className="mx-5">
                                {state.fieldErrors.password.map((error) => (
                                    <li key={error} className="text-red-500 text-sm mt-1 list-disc">{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {state?.formErrors && (
                    <p className="text-red-500 italic">{state.formErrors[0]}</p>
                )}

                <div className="mt-5 flex gap-2">
                    <BackButton url='/' className="bg-gray-200 text-gray-700 px-4 py-5 rounded w-1/2 text-md" variant="default" />
                    
                    <Button className="w-1/2 rounded py-5 text-md disabled:opacity-50 bg-accent-foreground text-white border border-accent-foreground hover:bg-accent-foreground/50" disabled={pending} type="submit" variant="outline">
                        {pending ? 'Signing up...' : 'Sign Up'}
                    </Button>
                </div>
            </form>
        </div>
    )
}
