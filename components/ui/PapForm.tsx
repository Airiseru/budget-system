'use client'

import { useState } from 'react'
import { useRouter } from "next/navigation"
import { Pap, NewPap } from "@/src/types/pap"
import LoadingOverlay from '@/components/ui/LoadingOverlay'
import { PAP_PROJECT_TYPE, PAP_PROJECT_TYPE_LABELS, PAP_PROJECT_TYPE_OPTIONS } from '@/src/lib/constants'

interface PapFormProps {
    pap?: Pap
    entityId?: string | null
    entityName: string
    successBasePath?: string
    cancelHref?: string
    defaultProjectStatus?: Pap['project_status']
    defaultProjectType?: string
    entityLockedLabel?: string
}

export default function PapForm({
    pap,
    entityId = null,
    entityName,
    successBasePath = '/paps',
    cancelHref = '/paps',
    defaultProjectStatus = 'draft',
    defaultProjectType = 'local',
    entityLockedLabel = 'Entity ID (Locked)',
}: PapFormProps) {
    const router = useRouter()
    const isEditing = !!pap
    const normalizedDefaultProjectType = normalizeProjectType(defaultProjectType)
    const initialProjectType = normalizeProjectType(pap?.project_type ?? normalizedDefaultProjectType)

    const [formData, setFormData] = useState<NewPap>({
        entity_id: pap?.entity_id || entityId,
        org_outcome_id: pap?.org_outcome_id || '',
        pip_code: pap?.pip_code || '',
        category: pap?.category || (initialProjectType === 'foreign' ? 'foreign' : 'local'),
        title: pap?.title || '',
        description: pap?.description || '',
        purpose: pap?.purpose || '',
        beneficiaries: pap?.beneficiaries || '',
        project_type: initialProjectType,
        identifier_code: pap?.identifier_code || getIdentifierCode(initialProjectType),
        actual_start_date: pap?.actual_start_date || null,
        project_status: pap?.project_status || defaultProjectStatus,
    })

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleProjectTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const projectType = normalizeProjectType(e.target.value)
        setFormData(prev => ({
            ...prev,
            project_type: projectType,
            category: projectType === 'foreign' ? 'foreign' : 'local',
            identifier_code: getIdentifierCode(projectType),
        }))
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
                router.push(`${successBasePath}/${data.id}`)
            } else {
                const data = await response.json().catch(() => null)
                setError(data?.error ?? 'Something went wrong')
            }
        } catch {
            setError('An error occurred while creating PAP')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-lg mx-auto mt-8">
            <LoadingOverlay show={isLoading} label="Saving PAP..." />
            <div className="mb-6 p-4 bg-gray-50 border rounded-lg shadow-sm">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entity Context</span>
                <p className="text-md font-semibold text-gray-700">{entityName}</p>
            </div>
            <h1 className="text-2xl font-bold mb-6">
                {isEditing ? 'Edit PAP' : 'Create PAP'}
            </h1>

            {error && (
                <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-600">{entityLockedLabel}</label>
                    <input
                        type="text"
                        value={formData.entity_id ?? 'null'}
                        disabled
                        className="bg-gray-100 border p-2 w-full rounded text-gray-500 cursor-not-allowed"
                    />
                </div>

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
                    <label className="block text-sm font-medium mb-1">Project Type</label>
                    <select
                        name="project_type"
                        value={formData.project_type ?? ''}
                        onChange={handleProjectTypeChange}
                        className="border p-2 w-full rounded"
                        disabled={isLoading}
                    >
                        {PAP_PROJECT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
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
                        onClick={() => router.push(cancelHref)}
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

function normalizeProjectType(value?: string | null): PAP_PROJECT_TYPE {
    if (!value) return 'local'
    const normalized = value.trim().toLowerCase().replaceAll(' ', '_')
    if (normalized in PAP_PROJECT_TYPE_LABELS) return normalized as PAP_PROJECT_TYPE
    return 'local'
}

function getIdentifierCode(projectType: PAP_PROJECT_TYPE): '1' | '2' | '3' {
    if (projectType === 'local') return '2'
    if (projectType === 'foreign') return '3'
    return '1'
}
