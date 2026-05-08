'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type PapUacsFields = {
    id: string
    cost_structure_code: string | null
    organizational_outcome_code: string | null
    program_code: string | null
    subprogram_code: string | null
    identifier_code: string | null
    project_title_code: string | null
    reserved_codes: string | null
}

export default function PapUacsEditor({ pap }: { pap: PapUacsFields }) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState({
        cost_structure_code: pap.cost_structure_code ?? '',
        organizational_outcome_code: pap.organizational_outcome_code ?? '',
        program_code: pap.program_code ?? '',
        subprogram_code: pap.subprogram_code ?? '',
        identifier_code: pap.identifier_code ?? '',
        project_title_code: pap.project_title_code ?? '',
        reserved_codes: pap.reserved_codes ?? '',
    })

    async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsSaving(true)
        setError(null)

        try {
            const response = await fetch(`/api/paps/${pap.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })

            if (!response.ok) {
                const payload = await response.text()
                setError(payload || 'Failed to update PAP UACS fields.')
                return
            }

            router.refresh()
        } catch {
            setError('A network error occurred while updating the PAP.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="rounded-xl border overflow-hidden">
            <div className="border-b bg-gray-50 px-4 py-3">
                <h2 className="text-sm font-bold text-gray-900">PAP UACS Assignment</h2>
                <p className="text-xs text-gray-500 mt-1">Update the code segments assigned to this PAP here.</p>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Cost Structure Code</span>
                        <input
                            value={form.cost_structure_code}
                            onChange={(event) => setForm((current) => ({ ...current, cost_structure_code: event.target.value }))}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Organizational Outcome Code</span>
                        <input
                            value={form.organizational_outcome_code}
                            onChange={(event) => setForm((current) => ({ ...current, organizational_outcome_code: event.target.value }))}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Program Code</span>
                        <input
                            value={form.program_code}
                            onChange={(event) => setForm((current) => ({ ...current, program_code: event.target.value }))}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Subprogram Code</span>
                        <input
                            value={form.subprogram_code}
                            onChange={(event) => setForm((current) => ({ ...current, subprogram_code: event.target.value }))}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Identifier Code</span>
                        <input
                            value={form.identifier_code}
                            onChange={(event) => setForm((current) => ({ ...current, identifier_code: event.target.value }))}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Project Title Code</span>
                        <input
                            value={form.project_title_code}
                            onChange={(event) => setForm((current) => ({ ...current, project_title_code: event.target.value }))}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1 md:col-span-2 xl:col-span-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Reserved Codes</span>
                        <input
                            value={form.reserved_codes}
                            onChange={(event) => setForm((current) => ({ ...current, reserved_codes: event.target.value }))}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                        />
                    </label>
                </div>

                <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving} className="w-full py-5 text-md bg-accent-foreground text-white">
                        {isSaving ? 'Saving...' : 'Save UACS Codes'}
                    </Button>
                </div>
            </form>
        </div>
    )
}
