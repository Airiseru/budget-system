'use client'

import { useState } from 'react'
import { useRouter } from "next/navigation"
import { Pap, NewPap } from "@/src/types/pap"

interface PapFormProps {
    pap?: Pap
}

export default function PapForm({ pap }: PapFormProps) {
    const router = useRouter()
    const isEditing = !!pap

    const [formData, setFormData] = useState<NewPap>({
        entity_id: pap?.entity_id || '',
        org_outcome_id: pap?.org_outcome_id || '',
        pip_code: pap?.pip_code || '',
        category: pap?.category || 'local',
        title: pap?.title || '',
        description: pap?.description || '',
        purpose: pap?.purpose || '',
        beneficiaries: pap?.beneficiaries || '',
        project_type: pap?.project_type || '',
        uacs_pap_code: pap?.uacs_pap_code || '',
        actual_start_date: pap?.actual_start_date || null,
        project_status: pap?.project_status || 'draft',
        auth_status: pap?.auth_status || '',
    })

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const endpoint = isEditing ? `/api/paps/${pap.id}` : '/api/paps'
        const method = isEditing ? 'PUT' : 'POST'

        try {
            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })

            if (response.ok) {
                const data = await response.json()
                router.refresh()
                router.push(`/paps/${data.id}`)
            } else {
                setError('Something went wrong')
            }
        } catch (error) {
            setError('An error occurred while creating PAP')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-lg mx-auto mt-8">
            <h1 className="text-2xl font-bold mb-6">
                {isEditing ? 'Edit PAP' : 'Create PAP'}
            </h1>

            {error && (
                <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* TURN INTO SELECT COMPONENT */}
                {isEditing ? (
                    <div>
                        <label className="block text-sm font-medium mb-1">Entity ID</label>
                        <p>{formData.entity_id}</p>
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium mb-1">Entity ID</label>
                        <input
                            name="entity_id"
                            type="text"
                            value={formData.entity_id}
                            onChange={handleChange}
                            placeholder="Entity ID"
                            className="border p-2 w-full rounded"
                            required
                            disabled={isLoading}
                        />
                    </div>
                )
                }

                <div>
                    <label className="block text-sm font-medium mb-1">Organizational Outcome</label>
                    <input
                        name="org_outcome_id"
                        type="text"
                        value={formData.org_outcome_id}
                        onChange={handleChange}
                        placeholder="Organizational Outcome ID"
                        className="border p-2 w-full rounded"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                        name="title"
                        type="text"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="Title"
                        className="border p-2 w-full rounded"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                        name="description"
                        value={formData.description ?? ''}
                        onChange={handleChange}
                        placeholder="Description"
                        className="border p-2 w-full rounded"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Purpose</label>
                    <textarea
                        name="purpose"
                        value={formData.purpose ?? ''}
                        onChange={handleChange}
                        placeholder="Purpose"
                        className="border p-2 w-full rounded"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Beneficiaries</label>
                    <textarea
                        name="beneficiaries"
                        value={formData.beneficiaries ?? ''}
                        onChange={handleChange}
                        placeholder="Beneficiaries"
                        className="border p-2 w-full rounded"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-accent-foreground text-white px-4 py-2 rounded disabled:opacity-50"
                    >
                        {isLoading ? 'Saving...' : isEditing ? 'Update PAP' : 'Create PAP'}
                    </button>

                    <button
                        type="button"
                        onClick={() => router.push('/paps')}
                        disabled={isLoading}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}