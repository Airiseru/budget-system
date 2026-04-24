'use client'

import { useState } from 'react'
import { useRouter } from "next/navigation"
import { StaffingSummaryWithPositions } from "@/src/types/staffing"
import { AllSalaryRates, CompensationRule } from '@/src/types/salaries'
import { staffingFormSchema } from '@/src/lib/validations/staffing.schema'
import {
    computeCompensationAmount,
    getRataOptions,
    buildAutoCompensations,
} from '@/src/lib/compensation-calc'
import React from 'react'

interface StaffingSummaryProps {
    schedule: AllSalaryRates
    compensationRules: CompensationRule[]
    highestSG: number
    fiscalYear?: number
    staff?: StaffingSummaryWithPositions
    availablePaps: { id: string; title: string; tier: number }[]
    userId: string
    entityId: string
    entityName: string
    isDBM?: boolean
}

type CompensationFormInput = {
    id?: string
    staff_id?: string
    compensation_rule_id: string | null
    name: string
    amount: number
}

type PositionFormInput = {
    id?: string
    staffing_summary_id?: string
    pap_id: string
    tier?: number
    staff_type: string
    organizational_unit: string
    position_title: string
    salary_schedule_id: string
    salary_grade: number
    step: number
    monthly_base_salary: number
    num_positions: number
    months_employed: number
    total_salary: number
    selected_rata_rule_id: string | null
    magna_carta_amount: number 
    compensations: CompensationFormInput[]
}

export default function StaffForm({
    schedule,
    compensationRules,
    highestSG,
    fiscalYear,
    staff,
    availablePaps,
    userId,
    entityId,
    entityName,
    isDBM = false,
}: StaffingSummaryProps) {
    const router = useRouter()
    const isEditing = !!staff

    // ---- helpers ----

    const getBaseSalary = (sg: number, step: number): number =>
        Number(schedule?.rates?.find(r => r.salary_grade === sg && r.step === step)?.amount ?? 0)

    const buildDefaultPosition = (): PositionFormInput => {
        const sg = 1
        const step = 1
        const monthly = getBaseSalary(sg, step)
        const num = 1
        const months = 12
        return {
            pap_id: '',
            position_title: '',
            num_positions: num,
            salary_schedule_id: schedule?.id ?? '',
            salary_grade: sg,
            step,
            monthly_base_salary: monthly,
            total_salary: monthly * num * months,
            staff_type: 'Casual',
            organizational_unit: '',
            months_employed: months,
            selected_rata_rule_id: null,
            magna_carta_amount: 0,
            compensations: buildAutoCompensations(
                compensationRules, sg, monthly, num, months, null
            ),
        }
    }

    const recomputeCompensations = (
        pos: PositionFormInput,
        overrides: Partial<PositionFormInput> = {}
    ): CompensationFormInput[] => {
        const sg = overrides.salary_grade ?? pos.salary_grade
        const monthly = overrides.monthly_base_salary ?? pos.monthly_base_salary
        const num = overrides.num_positions ?? pos.num_positions
        const months = overrides.months_employed ?? pos.months_employed
        const rataId = overrides.selected_rata_rule_id !== undefined
            ? overrides.selected_rata_rule_id
            : pos.selected_rata_rule_id

        return buildAutoCompensations(compensationRules, sg, monthly, num, months, rataId)
    }

    // ---- state ----

    const [formData, setFormData] = useState<{
        fiscal_year: number
        positions: PositionFormInput[]
    }>({
        fiscal_year: fiscalYear ?? new Date().getFullYear() + 1,
        positions: staff?.positions.map(p => {
            const magnaComp = p.compensations?.find(c => c.name.toLowerCase().includes('magna carta'))
            return {
                ...p,
                selected_rata_rule_id: null,
                magna_carta_amount: magnaComp ? Number(magnaComp.amount) : 0,
                compensations: p.compensations?.filter(c => !c.name.toLowerCase().includes('magna carta')).map(c => ({
                    ...c,
                    compensation_rule_id: c.compensation_rule_id ?? '',
                })) ?? [],
            }
        }) ?? [buildDefaultPosition()],
    })

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [submitAction, setSubmitAction] = useState<'draft' | 'pending_personnel' | 'pending_dbm'>('draft')

    // ---- styling ----

    const getFieldStyle = (path: string) =>
        fieldErrors[path]
            ? 'border-destructive bg-destructive/10 focus:ring-destructive'
            : 'border-border focus:ring-primary transition-all'

    const clearFieldError = (path: string) => {
        if (fieldErrors[path]) {
            setFieldErrors(prev => { const u = { ...prev }; delete u[path]; return u })
        }
    }

    const getTierForPap = (papId: string) =>
        availablePaps.find(p => p.id === papId)?.tier ?? 1

    // ---- position handlers ----

    const updatePosition = (index: number, updates: Partial<PositionFormInput>) => {
        setFormData(prev => {
            const positions = [...prev.positions]
            const current = positions[index]
            const merged = { ...current, ...updates }

            // recompute base salary when SG/step changes
            if (updates.salary_grade !== undefined || updates.step !== undefined) {
                merged.monthly_base_salary = getBaseSalary(
                    merged.salary_grade, merged.step
                )
            }

            // recompute total salary
            if (
                updates.salary_grade !== undefined ||
                updates.step !== undefined ||
                updates.num_positions !== undefined ||
                updates.months_employed !== undefined
            ) {
                merged.total_salary =
                    merged.monthly_base_salary * merged.num_positions * merged.months_employed
            }

            // recompute all compensations when anything that affects them changes
            if (
                updates.salary_grade !== undefined ||
                updates.step !== undefined ||
                updates.num_positions !== undefined ||
                updates.months_employed !== undefined ||
                updates.selected_rata_rule_id !== undefined
            ) {
                merged.compensations = recomputeCompensations(current, merged)
            }

            positions[index] = merged
            return { ...prev, positions }
        })
    }

    const handlePapChange = (index: number, papId: string) => {
        updatePosition(index, { pap_id: papId, tier: getTierForPap(papId) })
        clearFieldError(`positions.${index}.pap_id`)
    }

    const handlePositionChange = (index: number, field: keyof PositionFormInput, value: any) => {
        updatePosition(index, { [field]: value })
        clearFieldError(`positions.${index}.${field}`)
    }

    const handleRataChange = (index: number, rataRuleId: string) => {
        updatePosition(index, { selected_rata_rule_id: rataRuleId || null })
    }

    const addRow = () => {
        setFormData(prev => ({
            ...prev,
            positions: [...prev.positions, buildDefaultPosition()],
        }))
    }

    const removeRow = (index: number) => {
        setFormData(prev => {
            const updated = prev.positions.filter((_, i) => i !== index)
            return { ...prev, positions: updated.length ? updated : [buildDefaultPosition()] }
        })
    }

    // ---- submit ----

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setFieldErrors({})

        const positionsToSubmit = formData.positions.map(p => {
            const finalComps = [...p.compensations]
            if (p.magna_carta_amount > 0) {
                const mcRule = compensationRules.find(r => r.name.toLowerCase().includes('magna carta'))
                
                finalComps.push({
                    compensation_rule_id: mcRule?.id ?? null, 
                    name: mcRule?.name ?? 'Compensation Related Magna Carta Benefits',
                    amount: p.magna_carta_amount
                })
            }
            return { ...p, compensations: finalComps }
        })

        const result = staffingFormSchema.safeParse({
            fiscal_year: formData.fiscal_year,
            positions: positionsToSubmit
        })

        if (!result.success) {
            const newErrors: Record<string, string> = {}
            result.error.issues.forEach(err => {
                newErrors[err.path.join('.')] = err.message
            })
            console.log(newErrors)
            setFieldErrors(newErrors)
            setError('Validation failed. Please check the highlighted fields.')
            setIsLoading(false)
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return
        }

        const payload = {
            userId,
            entityId,
            summary: { fiscal_year: result.data.fiscal_year },
            positions: result.data.positions,
            auth_status: submitAction,
            isDBM
        }

        const endpoint = isEditing ? `/api/staff/${staff.id}` : '/api/staff'
        const method = isEditing ? 'PUT' : 'POST'

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (response.ok) {
                const data = await response.json()
                router.refresh()
                router.push(data.summaryId || staff?.id
                    ? `/forms/staff/${data.summaryId ?? staff?.id}`
                    : '/forms/staff'
                )
            } else {
                const errData = await response.json()
                setError(errData.error ?? 'Something went wrong')
            }
        } catch {
            setError('An error occurred while saving.')
        } finally {
            setIsLoading(false)
        }
    }

    // ---- renderers ----

    const renderPositionRow = (pos: PositionFormInput, index: number) => {
        const path = `positions.${index}`
        const rataOptions = getRataOptions(compensationRules, pos.salary_grade)

        const formatCurrency = (n: number) =>
            new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

        const displayCompensations = [...pos.compensations]
        if (pos.magna_carta_amount > 0) {
            displayCompensations.push({
                compensation_rule_id: null, 
                name: 'Compensation Related Magna Carta Benefits',
                amount: pos.magna_carta_amount
            })
        }

        return (
            <React.Fragment key={pos.id ?? index}>
                {/* main position row */}
                <tr className="hover:bg-muted/50 border-y">
                    <td className="p-2 border-r align-top">
                        <select
                            className={`w-full p-1 border rounded bg-card text-sm ${getFieldStyle(`${path}.pap_id`)}`}
                            value={pos.pap_id}
                            onChange={e => handlePapChange(index, e.target.value)}
                        >
                            <option value="">Select PAP...</option>
                            {availablePaps.map(pap => (
                                <option key={pap.id} value={pap.id}>{pap.title}</option>
                            ))}
                        </select>
                        <select
                            className={`w-full mt-2 p-1 border rounded text-sm font-medium ${getFieldStyle(`${path}.staff_type`)}`}
                            value={pos.staff_type}
                            onChange={e => handlePositionChange(index, 'staff_type', e.target.value)}
                        >
                            <option value="Casual">Casual</option>
                            <option value="Contractual">Contractual</option>
                            <option value="Part-Time">Part-Time</option>
                            <option value="Substitute">Substitute</option>
                        </select>
                    </td>
                    <td className="p-2 border-r align-top space-y-2">
                        <input
                            placeholder="Position Title"
                            className={`w-full p-1 border rounded font-medium text-sm ${getFieldStyle(`${path}.position_title`)}`}
                            value={pos.position_title}
                            onChange={e => handlePositionChange(index, 'position_title', e.target.value)}
                        />
                        <input
                            placeholder="Org Unit"
                            className={`w-full p-1 border rounded text-sm italic ${getFieldStyle(`${path}.organizational_unit`)}`}
                            value={pos.organizational_unit}
                            onChange={e => handlePositionChange(index, 'organizational_unit', e.target.value)}
                        />
                    </td>
                    <td className="p-2 border-r align-top">
                        <input
                            type="number" min="1" max="12"
                            className={`w-full p-1 border rounded text-center text-sm ${getFieldStyle(`${path}.months_employed`)}`}
                            value={pos.months_employed}
                            onChange={e => handlePositionChange(index, 'months_employed', parseInt(e.target.value))}
                        />
                    </td>
                    <td className="p-2 border-r align-top">
                        <input
                            type="number" min="1"
                            className={`w-full p-1 border rounded text-center text-sm ${getFieldStyle(`${path}.num_positions`)}`}
                            value={pos.num_positions}
                            onChange={e => handlePositionChange(index, 'num_positions', parseInt(e.target.value))}
                        />
                    </td>
                    <td className="p-2 border-r align-top">
                        <input
                            type="number" min="1" max={highestSG} placeholder="SG"
                            className={`w-full p-1 border rounded text-center text-sm ${getFieldStyle(`${path}.salary_grade`)}`}
                            value={pos.salary_grade}
                            onChange={e => handlePositionChange(index, 'salary_grade', parseInt(e.target.value))}
                        />
                    </td>
                    <td className="p-2 border-r align-top">
                        <input
                            placeholder="Step"
                            className={`w-full p-1 border rounded text-center bg-muted/50 text-sm ${getFieldStyle(`${path}.step`)}`}
                            value={pos.step}
                            disabled
                        />
                    </td>
                    <td className="p-2 align-top relative group">
                        <input
                            className={`w-full p-1 border rounded text-center bg-muted/50 font-mono text-sm ${getFieldStyle(`${path}.total_salary`)}`}
                            value={formatCurrency(pos.total_salary)}
                            disabled
                        />
                        <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="absolute -right-2 -top-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            ✕
                        </button>
                    </td>
                </tr>

                {/* compensations sub-row */}
                <tr className="bg-muted/20">
                    <td colSpan={7} className="px-10 py-3">
                        <div className="space-y-3">
                            {/* Special Overrides Row (RATA + Magna Carta) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* RATA selector */}
                                {rataOptions.length > 0 && (
                                    <div className="flex items-center gap-3 bg-secondary-foreground/10 border border-secondary-foreground/20 rounded-lg px-3 py-2">
                                        <span className="text-sm font-bold uppercase text-secondary-foreground whitespace-nowrap">
                                            RATA
                                        </span>
                                        <select
                                            className="flex-1 text-sm border border-secondary-foreground/30 rounded p-1 bg-white focus:ring-1 focus:ring-secondary-foreground outline-none"
                                            value={pos.selected_rata_rule_id ?? ''}
                                            onChange={e => handleRataChange(index, e.target.value)}
                                        >
                                            <option value="">— No RATA —</option>
                                            {rataOptions.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {formatCurrency(
                                                        computeCompensationAmount(
                                                            r,
                                                            pos.monthly_base_salary,
                                                            pos.num_positions,
                                                            pos.months_employed
                                                        )
                                                    )} ({r.calculation_type})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Magna Carta Manual Input */}
                                <div className="flex items-center gap-3 bg-accent-foreground border border-transparent rounded-lg px-3 py-2">
                                    <span className="text-sm font-bold uppercase text-white whitespace-nowrap">
                                        Magna Carta
                                    </span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-2 top-[3px] text-slate-500 text-sm">₱</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full text-sm border-none rounded p-1 pl-6 bg-white focus:ring-2 focus:ring-accent-foreground outline-none tabular-nums shadow-sm"
                                            value={pos.magna_carta_amount || ''}
                                            onChange={e => handlePositionChange(index, 'magna_carta_amount', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* auto-computed compensation list */}
                            {displayCompensations.length > 0 ? (
                                <div className="bg-card border rounded-lg overflow-hidden shadow-sm mt-3">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-muted/50 text-muted-foreground font-bold uppercase">
                                            <tr>
                                                <th className="px-3 py-2 border-b">Benefit / Allowance</th>
                                                <th className="px-3 py-2 border-b">Basis</th>
                                                <th className="px-3 py-2 border-b text-right w-40">Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {displayCompensations.map((comp, cIdx) => {
                                                const rule = compensationRules.find(r => r.id === comp.compensation_rule_id)
                                                return (
                                                    <tr key={cIdx} className="border-y">
                                                        <td className="px-3 py-2 font-medium">{comp.name}</td>
                                                        <td className="px-3 py-2 text-muted-foreground">
                                                            {comp.compensation_rule_id === ''
                                                                ? 'manual'
                                                                : rule
                                                                    ? `${rule.calculation_type.replace('_', ' ')} per ${rule.frequency} @ ${Number(rule.rule_value).toLocaleString()}${rule.calculation_type === 'percentage' ? '%' : ''}`
                                                                    : '—'
                                                            }
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">
                                                            {formatCurrency(comp.amount)}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                        <tfoot className="bg-muted/30 font-bold border-t">
                                            <tr>
                                                <td colSpan={2} className="px-3 py-2 text-sm uppercase">
                                                    Total Compensations
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono tabular-nums">
                                                    {formatCurrency(
                                                        displayCompensations.reduce((sum, c) => sum + c.amount, 0)
                                                    )}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic px-1 mt-3">
                                    No applicable compensation rules for SG {pos.salary_grade}.
                                </p>
                            )}
                        </div>
                    </td>
                </tr>

                {/* spacer row */}
                <tr>
                    <td colSpan={7} className="h-1 bg-muted/10" />
                </tr>
            </React.Fragment>
        )
    }

    const TableHeader = () => (
        <thead className="bg-muted/50 border-b text-muted-foreground">
            <tr>
                <th className="p-3 w-1/4 font-semibold text-sm uppercase text-left">Target PAP</th>
                <th className="p-3 w-1/4 font-semibold text-sm uppercase text-left">Position / Unit</th>
                <th className="p-3 w-24 font-semibold text-sm uppercase text-center">Months</th>
                <th className="p-3 w-20 font-semibold text-sm uppercase text-center">Qty</th>
                <th className="p-3 w-24 font-semibold text-sm uppercase text-center">SG</th>
                <th className="p-3 w-24 font-semibold text-sm uppercase text-center">Step</th>
                <th className="p-3 w-36 font-semibold text-sm uppercase text-center">Total Salary</th>
            </tr>
        </thead>
    )

    const renderTierGroups = (tier: number) => {
        const staffTypes = ['Casual', 'Contractual', 'Part-Time', 'Substitute']
        return staffTypes.map(type => {
            const hasPositions = formData.positions.some(
                p => p.pap_id && getTierForPap(p.pap_id) === tier && p.staff_type === type
            )
            if (!hasPositions) return null

            return (
                <div key={type} className="mt-4">
                    <div className="bg-muted px-3 py-2 text-sm font-bold uppercase tracking-widest border rounded-t-sm">
                        {type} Positions
                    </div>
                    <div className="border rounded-b-lg overflow-hidden bg-card shadow-sm">
                        <table className="w-full text-sm table-fixed">
                            <TableHeader />
                            <tbody>
                                {formData.positions.map((p, idx) =>
                                    p.pap_id && getTierForPap(p.pap_id) === tier && p.staff_type === type
                                        ? renderPositionRow(p, idx)
                                        : null
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
        })
    }

    return (
        <div key="staffing-form" className="max-w-5xl mx-auto mt-8 px-4 pb-20">
            <div className="mb-6 p-4 bg-muted/50 border-l-4 border-border rounded-r-lg">
                <span className="text-sm font-bold text-muted-foreground uppercase">Agency</span>
                <h2 className="text-lg font-semibold">{entityName}</h2>
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6 border border-destructive/20 flex flex-col gap-1">
                    <span className="font-bold text-sm">Error</span>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* fiscal year */}
                <div className="bg-card p-6 rounded-xl border shadow-sm">
                    <label className="block text-sm font-semibold mb-1">Fiscal Year</label>
                    <input
                        type="number"
                        value={formData.fiscal_year}
                        onChange={e => setFormData({ ...formData, fiscal_year: parseInt(e.target.value) })}
                        className={`border p-2 w-32 rounded outline-none ${getFieldStyle('fiscal_year')} text-sm`}
                    />
                </div>

                {/* uncategorized positions */}
                <div className="space-y-2">
                    <div className="bg-primary text-primary-foreground px-4 py-2 rounded-t-lg font-bold text-sm uppercase">
                        New Entries (Not Yet Categorized)
                    </div>
                    <div className="border rounded-b-lg overflow-hidden bg-card shadow-sm">
                        <table className="w-full text-sm table-fixed">
                            <TableHeader />
                            <tbody>
                                {formData.positions.map((p, idx) =>
                                    !p.pap_id ? renderPositionRow(p, idx) : null
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* tier 1 */}
                <div className="mt-10">
                    <h3 className="text-sm font-black text-accent-foreground border-b-2 border-accent-foreground pb-1">
                        TIER 1: ONGOING PROGRAMS
                    </h3>
                    {renderTierGroups(1)}
                </div>

                {/* tier 2 */}
                <div className="mt-10">
                    <h3 className="text-sm font-black border-b-2 border-secondary-foreground pb-1 text-secondary-foreground">
                        TIER 2: NEW PROPOSALS
                    </h3>
                    {renderTierGroups(2)}
                </div>

                {/* footer actions */}
                <div className="flex justify-between items-center bg-muted/50 p-4 rounded-lg border">
                    <button
                        type="button"
                        onClick={addRow}
                        className="text-sm font-bold hover:underline"
                    >
                        + Add New Position Row
                    </button>
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            onClick={() => setSubmitAction(isDBM ? 'pending_dbm' : 'draft')}
                            className="px-6 py-2 border bg-white text-secondary-foreground rounded-md hover:text-white hover:bg-secondary-foreground transition-all font-medium text-sm"
                            disabled={isLoading}
                        >
                            Save Draft
                        </button>
                        <button
                            type="submit"
                            onClick={() => setSubmitAction(isDBM ? 'pending_dbm' : 'pending_personnel')}
                            className="px-6 py-2 bg-accent-foreground text-white rounded-md hover:bg-accent-foreground/50 hover:text-black transition-all font-medium text-sm"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Submitting...' : 'Submit Form'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}