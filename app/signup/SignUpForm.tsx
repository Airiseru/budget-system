"use client"

import { signup } from "@/app/actions/auth"
import { useActionState, useState } from "react"
import { Department, Agency } from "@/src/types/entities"
import { BackButton } from "@/components/ui/BackButton"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Eye, EyeOff } from 'lucide-react'

type Props = {
    departments: Department[];
    agencies: Agency[];
}

export default function SignUpForm({ departments, agencies }: Props) {
    const [state, action, pending] = useActionState(signup, undefined)
    const [selectedEntityId, setSelectedEntityId] = useState<string>(state?.values?.entity_id || '')
    const [showPassword, setShowPassword] = useState(false)

    const independentAgencies = agencies.filter(a => a.department_id === null)

    const handleEntityChange = (value: string | null) => {
        setSelectedEntityId(value ?? '')
    }

    const getEntityName = (id: string) => {
        const dept = departments.find(d => d.id === id)
        if (dept) return `${dept.name} (Central Office)`
        const agency = agencies.find(a => a.id === id)
        if (agency) return agency.name
        return ''
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

                    <Select 
                        value={selectedEntityId}
                        onValueChange={handleEntityChange}
                    >
                        <SelectTrigger className="border px-3 py-5 w-full rounded my-1 border-border text-base">
                            <SelectValue placeholder="Select your Department or Agency">
                                {selectedEntityId 
                                    ? getEntityName(selectedEntityId) 
                                    : <span className="text-gray-400">Select your Department or Agency</span>
                                }
                        </SelectValue>

                        </SelectTrigger>
                        
                        <SelectContent>
                            {/* Standard Departments and Agencies */}
                            {departments.map((dept) => {
                                const childAgencies = agencies.filter(a => a.department_id === dept.id)
                                
                                return (
                                    <SelectGroup key={dept.id}>
                                        {/* SelectLabel replaces optgroup label */}
                                        <SelectLabel className="bg-muted/50">{dept.name}</SelectLabel>
                                        
                                        <SelectItem value={dept.id}>
                                            {dept.name} (Central Office)
                                        </SelectItem>
                                        
                                        {childAgencies.map((agency) => (
                                            <SelectItem key={agency.id} value={agency.id}>
                                                {agency.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                )
                            })}

                            {/* Independent Agencies */}
                            {independentAgencies.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel className="bg-muted/50">Independent Agencies & SUCs</SelectLabel>
                                    {independentAgencies.map((agency) => (
                                        <SelectItem key={agency.id} value={agency.id}>
                                            {agency.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            )}
                        </SelectContent>
                    </Select>
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
                    <button type="submit" disabled={pending} className="bg-accent-foreground text-white px-4 py-2 rounded w-full disabled:opacity-50">
                        {pending ? 'Signing up...' : 'Sign Up'}
                    </button>

                    <BackButton className="bg-gray-200 text-gray-700 px-4 py-2 rounded w-full" />
                </div>
            </form>
        </div>
    )
}