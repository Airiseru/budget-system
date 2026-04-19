'use client'

import { useState } from 'react'
import { useRouter } from "next/navigation"
import { StaffingSummaryWithPositions } from "@/src/types/staffing"
import { staffingFormSchema } from '@/src/lib/validations/staffing.schema'
import React from 'react'

interface StaffingSummaryProps {
    staff?: StaffingSummaryWithPositions;
    availablePaps: { id: string; title: string, tier: number }[];
    userId: string;
    entityId: string;
    entityName: string;
}

type PositionFormInput = {
    id?: string;
    staffing_summary_id?: string;
    pap_id: string;
    tier?: number;
    staff_type: string;
    organizational_unit: string;
    position_title: string;
    salary_grade: number;
    num_positions: number;
    months_employed: number;
    total_salary: number;
    compensations: {
        id?: string;
        staff_id?: string;
        name: string;
        amount: number;
    }[];
};

export default function StaffForm({ staff, availablePaps, userId, entityId, entityName }: StaffingSummaryProps) {
    const router = useRouter()
    const isEditing = !!staff

    const [formData, setFormData] = useState<{
        fiscal_year: number;
        positions: PositionFormInput[]; 
    }>({
        fiscal_year: staff?.fiscal_year || 2026,
        positions: staff?.positions.map(p => ({
            ...p,
            compensations: p.compensations || [] 
        })) || [
            { 
                pap_id: "", 
                position_title: "", 
                num_positions: 1, 
                salary_grade: 1,
                total_salary: 0,
                staff_type: "Casual",
                organizational_unit: "Main Office",
                months_employed: 12,
                compensations: [] 
            }
        ]
    });

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [submitAction, setSubmitAction] = useState<'draft' | 'pending_personnel'>('draft');

    // ===========================
    // HELPERS & STYLING
    // ===========================
    const getFieldStyle = (path: string) => {
        const hasError = !!fieldErrors[path];
        return hasError 
            ? "border-red-500 bg-red-50 focus:ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,1)]" 
            : "border-slate-200 focus:ring-primary-500 transition-all";
    };

    const clearFieldError = (path: string) => {
        if (fieldErrors[path]) {
            setFieldErrors(prev => {
                const updated = { ...prev };
                delete updated[path];
                return updated;
            });
        }
    };

    const getTierForPap = (papId: string) => {
        const selectedPap = availablePaps.find(p => p.id === papId);
        return selectedPap?.tier || 1;
    };

    const compensationNames = [
        'PERA', 'RATA', 'Clothing Allowance', 'Mid Year Bonus', 
        'End Year Bonus', 'Cash Gift', 'PEI', 'RLIP', 'Pag-IBIG', 'ECiP', 'PHIC'
    ];

    // ===========================
    // HANDLERS
    // ===========================
    const handlePapChange = (index: number, papId: string) => {
        const updatedPositions = [...formData.positions];
        const tier = getTierForPap(papId);
        updatedPositions[index] = { ...updatedPositions[index], pap_id: papId, tier };
        setFormData({ ...formData, positions: updatedPositions });
        clearFieldError(`positions.${index}.pap_id`);
    };

    const handlePositionChange = (index: number, field: string, value: any) => {
        const updatedPositions = [...formData.positions];
        updatedPositions[index] = { ...updatedPositions[index], [field]: value };
        setFormData({ ...formData, positions: updatedPositions });
        clearFieldError(`positions.${index}.${field}`);
    };

    const handleCompensationChange = (posIndex: number, compIndex: number, field: string, value: any) => {
        const updatedPositions = [...formData.positions];
        const updatedComps = [...updatedPositions[posIndex].compensations];
        updatedComps[compIndex] = { ...updatedComps[compIndex], [field]: value };
        updatedPositions[posIndex].compensations = updatedComps;
        setFormData({ ...formData, positions: updatedPositions });
        clearFieldError(`positions.${posIndex}.compensations.${compIndex}.${field}`);
    };

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setFieldErrors({});

        const result = staffingFormSchema.safeParse(formData);

        if (!result.success) {
            const newErrors: Record<string, string> = {};
            result.error.issues.forEach((err) => {
                const path = err.path.join('.');
                newErrors[path] = err.message;
            });

            setFieldErrors(newErrors);
            setError("Validation failed. Please check the highlighted red fields.");
            setIsLoading(false);
            console.log(fieldErrors)
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const payload = {
            userId,
            entityId,
            summary: { fiscal_year: result.data.fiscal_year },
            positions: result.data.positions,
            auth_status: submitAction
        };

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
                const targetId = data.summaryId || staff?.id;
                router.push(targetId ? `/forms/staff/${targetId}` : '/forms/staff');
            } else {
                const errData = await response.json()
                setError(errData.error || 'Something went wrong')
            }
        } catch (error) {
            setError('An error occurred while saving.')
        } finally {
            setIsLoading(false)
        }
    }

    // ===========================
    // RENDERERS
    // ===========================
    const renderPositionRow = (pos: any, index: number) => {
        const path = `positions.${index}`;

        return (
            <React.Fragment key={pos.id ?? index}>
                <tr key={`pos-${index}`} className="hover:bg-muted/50 border-b border-dotted">
                    <td className="p-2 border-r align-top">
                        <select
                            className={`w-full p-1 border rounded bg-card ${getFieldStyle(`${path}.pap_id`)}`}
                            value={pos.pap_id}
                            onChange={(e) => handlePapChange(index, e.target.value)}
                        >
                            <option value="">Select PAP...</option>
                            {availablePaps.map((pap) => (
                                <option key={pap.id} value={pap.id}>{pap.title}</option>
                            ))}
                        </select>
                        <select
                            className={`w-full mt-2 p-1 border rounded text-xs font-medium ${getFieldStyle(`${path}.staff_type`)}`}
                            value={pos.staff_type}
                            onChange={(e) => handlePositionChange(index, 'staff_type', e.target.value)}
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
                            className={`w-full p-1 border rounded font-medium ${getFieldStyle(`${path}.position_title`)}`}
                            value={pos.position_title} 
                            onChange={(e) => handlePositionChange(index, 'position_title', e.target.value)} 
                        />
                        <input 
                            placeholder="Org Unit"
                            className={`w-full p-1 border rounded text-xs italic ${getFieldStyle(`${path}.organizational_unit`)}`}
                            value={pos.organizational_unit} 
                            onChange={(e) => handlePositionChange(index, 'organizational_unit', e.target.value)} 
                        />
                    </td>
                    <td className="p-2 border-r align-top">
                        <input 
                            type="number"
                            min="1"
                            max="12"
                            className={`w-full p-1 border rounded text-center ${getFieldStyle(`${path}.months_employed`)}`}
                            value={pos.months_employed} 
                            onChange={(e) => handlePositionChange(index, 'months_employed', parseInt(e.target.value))} 
                        />
                    </td>
                    <td className="p-2 border-r align-top">
                        <input 
                            type="number"
                            min="1"
                            className={`w-full p-1 border rounded text-center ${getFieldStyle(`${path}.num_positions`)}`}
                            value={pos.num_positions} 
                            onChange={(e) => handlePositionChange(index, 'num_positions', parseInt(e.target.value))} 
                        />
                    </td>
                    <td className="p-2 border-r align-top">
                        <input
                            type="number"
                            min="1"
                            max="33"
                            placeholder="SG"
                            className={`w-full p-1 border rounded text-center ${getFieldStyle(`${path}.salary_grade`)}`}
                            value={pos.salary_grade} 
                            onChange={(e) => handlePositionChange(index, 'salary_grade', parseInt(e.target.value))}
                        />
                        <button type="button" onClick={() => removeRow(index)} className="absolute -right-2 -top-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </td>
                    <td className="p-2 align-top relative group">
                        <input 
                            type="number"
                            min="0"
                            className={`w-full p-1 border rounded text-center ${getFieldStyle(`${path}.total_salary`)}`}
                            value={pos.total_salary} 
                            onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                handlePositionChange(index, 'total_salary', val);
                            }} 
                        />
                        <button type="button" onClick={() => removeRow(index)} className="absolute -right-2 -top-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </td>
                </tr>
                {/* Nested Compensations */}
                {pos.compensations && pos.compensations.length > 0 && (
                    <tr className="bg-muted/30">
                        <td colSpan={6} className="p-4 pl-12 ">
                            <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-muted/50 text-[10px] uppercase font-bold text-muted-500">
                                        <tr>
                                            <th className="px-3 py-2 border-b">Allowance Type</th>
                                            <th className="px-3 py-2 border-b w-40 text-right">Amount (PHP)</th>
                                            <th className="px-3 py-2 border-b w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {pos.compensations.map((comp: any, cIdx: number) => (
                                            <tr key={cIdx}>
                                                <td className="px-3 py-2">
                                                    <select 
                                                        className={`w-full text-sm border rounded p-1 ${getFieldStyle(`${path}.compensations.${cIdx}.name`)}`}
                                                        value={comp.name}
                                                        onChange={(e) => handleCompensationChange(index, cIdx, 'name', e.target.value)}
                                                    >
                                                        {compensationNames.map(name => {
                                                            // Check if this name is already used in other compensation rows for THIS position
                                                            const isAlreadySelected = pos.compensations.some(
                                                                (c: any, i: number) => c.name === name && i !== cIdx
                                                            );

                                                            return (
                                                                <option 
                                                                    key={name} 
                                                                    value={name} 
                                                                    disabled={isAlreadySelected} // Disable the option if selected elsewhere
                                                                    className={isAlreadySelected ? "text-gray-400 bg-gray-100" : ""}
                                                                >
                                                                    {name} {isAlreadySelected ? "(Already Added)" : ""}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        className={`w-full text-sm border rounded text-right p-1 ${getFieldStyle(`${path}.compensations.${cIdx}.amount`)}`}
                                                        value={comp.amount}
                                                        onChange={(e) => handleCompensationChange(index, cIdx, 'amount', parseFloat(e.target.value))}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button type="button" onClick={() => removeCompensation(index, cIdx)} className="text-red-500">×</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                )}
                <tr className="">
                    <td colSpan={6} className="px-12 py-1 border-b pb-4 pt-2">
                         <button type="button" onClick={() => addCompensation(index)} className="bg-primary-foreground p-2 rounded text-[10px] text-primary font-bold uppercase">+ Add Allowance</button>
                    </td>
                </tr>
            </React.Fragment>
        );
    };

    const addRow = () => {
        setFormData({
            ...formData,
            positions: [...formData.positions, { 
                pap_id: "", position_title: "", num_positions: 1, salary_grade: 1, total_salary: 0,
                staff_type: "Casual", organizational_unit: "", months_employed: 12, compensations: []
            }]
        });
    };

    const removeRow = (index: number) => {
        const updated = formData.positions.filter((_, i) => i !== index);
        setFormData({ ...formData, positions: updated.length ? updated : [/* default empty row */] });
    };

    const addCompensation = (posIndex: number) => {
        const updated = [...formData.positions];
        const currentComps = updated[posIndex].compensations;

        // Find the first name in the master list that isn't used yet
        const nextAvailableName = compensationNames.find(
            name => !currentComps.some(c => c.name === name)
        );

        // Only add if there's an available allowance type left
        if (nextAvailableName) {
            updated[posIndex].compensations.push({ name: nextAvailableName, amount: 0 });
            setFormData({ ...formData, positions: updated });
        } else {
            alert("All available allowance types have been added for this position.");
        }
    };

    const removeCompensation = (posIndex: number, compIndex: number) => {
        const updated = [...formData.positions];
        updated[posIndex].compensations = updated[posIndex].compensations.filter((_, i) => i !== compIndex);
        setFormData({ ...formData, positions: updated });
    };

    const TableHeader = () => (
        <thead className="bg-muted/50 border-b text-muted-foreground">
            <tr>
                <th className="p-3 w-1/4 font-semibold text-xs uppercase text-left">Target PAP</th>
                <th className="p-3 w-1/4 font-semibold text-xs uppercase text-left">Position / Unit</th>
                <th className="p-3 w-24 font-semibold text-xs uppercase text-center">Months</th>
                <th className="p-3 w-20 font-semibold text-xs uppercase text-center">Qty</th>
                <th className="p-3 w-24 font-semibold text-xs uppercase text-center">SG</th>
                <th className="p-3 w-24 font-semibold text-xs uppercase text-center">Total Salary</th>
            </tr>
        </thead>
    );

    const renderTierGroups = (tier: number) => {
        const staffTypes = ["Casual", "Contractual", "Part-Time", "Substitute"];
        return staffTypes.map(type => {
            const positions = formData.positions.filter(p => p.pap_id && getTierForPap(p.pap_id) === tier && p.staff_type === type);
            if (!positions.length) return null;

            return (
                <div key={type} className="mt-4">
                    <div className="bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest border rounded-t-sm">
                        {type} Positions
                    </div>
                    <div className="border rounded-b-lg overflow-hidden bg-white shadow-sm">
                        <table className="w-full text-sm table-fixed">
                            <TableHeader />
                            <tbody>
                                {formData.positions.map((p, idx) => 
                                    (p.pap_id && getTierForPap(p.pap_id) === tier && p.staff_type === type) 
                                    ? renderPositionRow(p, idx) : null
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="max-w-5xl mx-auto mt-8 px-4 pb-20">
            <div className="mb-6 p-4 bg-muted/50 border-l-4 border-slate-400 rounded-r-lg">
                <span className="text-xs font-bold text-muted-500 uppercase">Agency</span>
                <h2 className="text-lg font-semibold">{entityName}</h2>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200 flex flex-col gap-1">
                    <span className="font-bold">Error</span>
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-card p-6 rounded-xl border shadow-sm">
                    <label className="block text-sm font-semibold mb-1">Fiscal Year</label>
                    <input 
                        type="number"
                        value={formData.fiscal_year} 
                        onChange={(e) => setFormData({...formData, fiscal_year: parseInt(e.target.value)})} 
                        className={`border p-2 w-32 rounded outline-none ${getFieldStyle('fiscal_year')}`}
                    />
                </div>

                {/* UNASSIGNED / NEW ENTRIES */}
                <div className="space-y-2">
                    <div className="bg-amber-600 text-white px-4 py-2 rounded-t-lg font-bold text-xs">NEW ENTRIES (NOT YET CATEGORIZED)</div>
                    <div className="border rounded-b-lg overflow-hidden bg-white shadow-sm">
                        <table className="w-full text-sm table-fixed">
                            <TableHeader />
                            <tbody>
                                {formData.positions.map((p, idx) => !p.pap_id ? renderPositionRow(p, idx) : null)}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-10">
                    <h3 className="text-sm font-black text-primary-800 border-b-2 border-primary-600 pb-1">TIER 1: ONGOING PROGRAMS</h3>
                    {renderTierGroups(1)}
                </div>

                <div className="mt-10">
                    <h3 className="text-sm font-black text-emerald-800 border-b-2 border-emerald-600 pb-1">TIER 2: NEW PROPOSALS</h3>
                    {renderTierGroups(2)}
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
                    <button type="button" onClick={addRow} className="text-sm font-bold text-primary-600 hover:underline">+ Add New Position Row</button>
                    <div className="flex gap-3">
                        <button type="submit" onClick={() => setSubmitAction("draft")} className="px-6 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-all font-medium" disabled={isLoading}>Save Draft</button>
                        <button type="submit" onClick={() => setSubmitAction("pending_personnel")} className="px-6 py-2 bg-accent-foreground text-white rounded-md hover:bg-accent-foreground/80 transition-all font-medium" disabled={isLoading}>Submit Form</button>
                    </div>
                </div>
            </form>
        </div>
    )
}