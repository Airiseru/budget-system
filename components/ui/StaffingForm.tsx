'use client'

import { useState } from 'react'
import { useRouter } from "next/navigation"
import { StaffingSummary, StaffingSummaryWithPositions } from "@/src/types/staffing"

interface PapOption {
    id: string;
    title: string;
}

interface StaffingSummaryProps {
    staff?: StaffingSummaryWithPositions;
    availablePaps: { id: string; title: string, tier: number }[];
    entityId: string;   // Added
    entityName: string; // Added
}

export default function StaffForm({ staff, availablePaps, entityId, entityName }: StaffingSummaryProps) {
    const router = useRouter()
    const isEditing = !!staff

    const [formData, setFormData] = useState({
        fiscal_year: staff?.fiscal_year || 2026,
        digital_signature: staff?.digital_signature || "",
        positions: staff?.positions || [
            { 
                pap_id: "", 
                position_title: "", 
                num_positions: 1, 
                salary_grade: "", 
                total_salary: 0,
                // ADD THESE DEFAULTS:
                staff_type: "Casual", 
                organizational_unit: "Main Office",
                months_employed: 12
            }
        ]
    });

    // Helper to get the tier of a selected PAP
    const getTierForPap = (papId: string) => {
        const selectedPap = availablePaps.find(p => p.id === papId);
        return selectedPap?.tier || 1; // Default to Tier 1 if not found
    };

    // Group positions by tier for the UI
    const tier1Positions = formData.positions.filter(pos => getTierForPap(pos.pap_id) === 1);
    const tier2Positions = formData.positions.filter(pos => getTierForPap(pos.pap_id) === 2);

    // Update the handle change for PAP selection
    const handlePapChange = (index: number, papId: string) => {
        const updatedPositions = [...formData.positions];
        const tier = getTierForPap(papId);
        
        updatedPositions[index] = { 
            ...updatedPositions[index], 
            pap_id: papId,
            tier: tier // This ensures the row knows its new home
        };
        
        setFormData({ ...formData, positions: updatedPositions });
    };

    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePositionChange = (index: number, field: string, value: any) => {
        const updatedPositions = [...formData.positions];
        updatedPositions[index] = { ...updatedPositions[index], [field]: value };
        setFormData({ ...formData, positions: updatedPositions });
    };

    const addRow = () => {
        setFormData({
            ...formData,
            positions: [
                ...formData.positions, 
                { 
                    pap_id: "", 
                    position_title: "", 
                    num_positions: 1, 
                    salary_grade: "", 
                    total_salary: 0,
                    staff_type: "Casual", 
                    organizational_unit: "",
                    months_employed: 12 
                }
            ]
        });
    };

    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);

        const payload = {
            entityId: entityId, // This now uses the ID from your Server Action
            summary: {
                fiscal_year: formData.fiscal_year,
                digital_signature: formData.digital_signature
            },
            positions: formData.positions
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
                const targetId = data.formId || staff?.id;
                router.push(targetId ? `/forms/staff/${targetId}` : '/forms/staff');
            } else {
                const errData = await response.json()
                setError(errData.error || 'Something went wrong')
            }
        } catch (error) {
            setError('An error occurred while saving the Staffing Summary')
        } finally {
            setIsLoading(false)
        }
    }

    const TableHeader = () => (
        <thead className="bg-slate-100 border-b text-slate-600">
            <tr>
                <th className="p-3 w-1/4 font-semibold text-xs uppercase">Target PAP</th>
                <th className="p-3 w-1/4 font-semibold text-xs uppercase">Position / Unit</th>
                <th className="p-3 w-32 font-semibold text-xs uppercase text-center">Months</th>
                <th className="p-3 w-20 font-semibold text-xs uppercase text-center">Qty</th>
                <th className="p-3 w-28 font-semibold text-xs uppercase">SG</th>
            </tr>
        </thead>
    );

    const renderPositionRow = (pos: any, index: number) => (
        <tr key={index} className="hover:bg-gray-50/50">
            <td className="p-2 border-r align-top">
                <select
                    className="w-full p-1 border rounded bg-white"
                    value={pos.pap_id}
                    onChange={(e) => handlePapChange(index, e.target.value)}
                    required
                >
                    <option value="">Select PAP...</option>
                    {availablePaps.map((pap) => (
                        <option key={pap.id} value={pap.id}>{pap.title}</option>
                    ))}
                </select>
                <select
                    className="w-full mt-2 p-1 border rounded bg-slate-50 text-xs font-medium"
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
                    className="w-full p-1 border rounded font-medium"
                    value={pos.position_title} 
                    onChange={(e) => handlePositionChange(index, 'position_title', e.target.value)} 
                />
                <input 
                    placeholder="Org Unit (e.g. HR Dept)"
                    className="w-full p-1 border rounded text-xs text-gray-500 italic"
                    value={pos.organizational_unit} 
                    onChange={(e) => handlePositionChange(index, 'organizational_unit', e.target.value)} 
                />
            </td>
            <td className="p-2 border-r">
                <input 
                    type="number"
                    min="1" max="12"
                    className="w-full p-1 border rounded text-center"
                    value={pos.months_employed} 
                    onChange={(e) => handlePositionChange(index, 'months_employed', parseInt(e.target.value))} 
                />
            </td>
            <td className="p-2 border-r">
                <input 
                    type="number"
                    className="w-full p-1 border rounded text-center"
                    value={pos.num_positions} 
                    onChange={(e) => handlePositionChange(index, 'num_positions', parseInt(e.target.value))} 
                />
            </td>
            <td className="p-2">
                <input 
                    placeholder="SG"
                    className="w-full p-1 border rounded"
                    value={pos.salary_grade} 
                    onChange={(e) => handlePositionChange(index, 'salary_grade', e.target.value)} 
                />
            </td>
        </tr>
    );

    const staffTypes = ["Casual", "Contractual", "Part-Time", "Substitute"];

    const renderTierGroups = (tier: number) => {
        return staffTypes.map(type => {
            const filteredPositions = formData.positions.filter(pos => {
                const papInfo = availablePaps.find(p => p.id === pos.pap_id);
                return pos.pap_id !== "" && (papInfo?.tier === tier) && pos.staff_type === type;
            });

            if (filteredPositions.length === 0) return null;

            return (
                <div key={type} className="mt-4">
                    <div className="bg-slate-200 px-3 py-1 text-[10px] font-bold text-slate-700 uppercase tracking-widest border-x border-t rounded-t-sm">
                        {type} Positions
                    </div>
                    <div className="border rounded-b-lg overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left table-fixed">
                            <TableHeader />
                            <tbody className="divide-y">
                                {formData.positions.map((pos, idx) => 
                                    (pos.pap_id !== "" && getTierForPap(pos.pap_id) === tier && pos.staff_type === type) 
                                    ? renderPositionRow(pos, idx) 
                                    : null
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        });
    };

    const removeRow = (index: number) => {
        // Don't allow deleting the last row if you want to keep the form active
        if (formData.positions.length <= 1) {
            setFormData({
                ...formData,
                positions: [{ pap_id: "", position_title: "", num_positions: 1, salary_grade: "", total_salary: 0, staff_type: "Casual", organizational_unit: "", months_employed: 12 }]
            });
            return;
        }
        const updatedPositions = formData.positions.filter((_, i) => i !== index);
        setFormData({ ...formData, positions: updatedPositions });
    };

    const renderUnassignedRows = () => {
        return formData.positions.map((pos, index) => {
            if (pos.pap_id !== "") return null; // Only show rows without a PAP

            return (
                <tr key={index} className="bg-amber-50/30 border-amber-200">
                    <td className="p-2 border-r align-top">
                        <select
                            className="w-full p-1 border rounded bg-white border-amber-300 focus:ring-amber-500 font-medium"
                            value={pos.pap_id}
                            onChange={(e) => handlePapChange(index, e.target.value)}
                            required
                        >
                            <option value="">Select a PAP to Assign...</option>
                            {availablePaps.map((pap) => (
                                <option key={pap.id} value={pap.id}>{pap.title}</option>
                            ))}
                        </select>
                        {/* Staff Type Selector */}
                        <select
                            className="w-full mt-2 p-1 border rounded bg-white text-xs font-semibold text-amber-700 border-amber-200"
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
                            className="w-full p-1 border rounded focus:border-amber-500 outline-none"
                            value={pos.position_title} 
                            onChange={(e) => handlePositionChange(index, 'position_title', e.target.value)} 
                            required
                        />
                        <input 
                            placeholder="Organizational Unit"
                            className="w-full p-1 border rounded text-xs italic bg-white/50"
                            value={pos.organizational_unit} 
                            onChange={(e) => handlePositionChange(index, 'organizational_unit', e.target.value)} 
                            required
                        />
                    </td>
                    <td className="p-2 border-r align-middle">
                        <div className="flex flex-col items-center gap-1">
                            <input 
                                type="number"
                                min="1" max="12"
                                className="w-16 p-1 border rounded text-center"
                                value={pos.months_employed} 
                                onChange={(e) => handlePositionChange(index, 'months_employed', parseInt(e.target.value))} 
                            />
                            <span className="text-[10px] text-gray-400 uppercase font-bold">Months</span>
                        </div>
                    </td>
                    <td className="p-2 border-r align-middle">
                        <input 
                            type="number"
                            min="1"
                            className="w-full p-1 border rounded text-center font-bold"
                            value={pos.num_positions} 
                            onChange={(e) => handlePositionChange(index, 'num_positions', parseInt(e.target.value))} 
                        />
                    </td>
                    <td className="p-2 align-middle relative group">
                        <input 
                            placeholder="SG"
                            className="w-full p-1 border rounded text-center"
                            value={pos.salary_grade} 
                            onChange={(e) => handlePositionChange(index, 'salary_grade', e.target.value)} 
                            required
                        />
                        {/* Row Delete Button */}
                        <button 
                            type="button"
                            onClick={() => removeRow(index)}
                            className="absolute -right-2 -top-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            ✕
                        </button>
                    </td>
                </tr>
            );
        });
    };

    const renderRowsByTier = (tier: number) => {
        return formData.positions.map((pos, index) => {
            const papInfo = availablePaps.find(p => p.id === pos.pap_id);
            const currentPosTier = papInfo?.tier || 0; // 0 means unassigned

            // If the row is unassigned, don't show it in Tier 1 or 2 tables
            if (pos.pap_id === "") return null;
            
            // Only show if it matches the current tier being rendered
            if (currentPosTier !== tier) return null;

            return (
                <tr key={index} className="hover:bg-gray-50/50">
                    <td className="p-2 border-r">
                        <select
                            className="w-full p-1 border rounded bg-white"
                            value={pos.pap_id}
                            // USE THE NEW HANDLER HERE
                            onChange={(e) => handlePapChange(index, e.target.value)}
                            required
                        >
                            <option value="" disabled>Select a PAP</option>
                            {availablePaps.map((pap) => (
                                <option key={pap.id} value={pap.id}>{pap.title}</option>
                            ))}
                        </select>
                    </td>
                    {/* ... rest of your inputs (Position, Qty, Salary) ... */}
                    <td className="p-2 border-r">
                        <input 
                            className="w-full p-1 border rounded"
                            value={pos.position_title} 
                            onChange={(e) => handlePositionChange(index, 'position_title', e.target.value)} 
                        />
                    </td>
                    <td className="p-2 border-r">
                        <input 
                            type="number"
                            className="w-full p-1 border rounded text-center"
                            value={pos.num_positions} 
                            onChange={(e) => handlePositionChange(index, 'num_positions', parseInt(e.target.value))} 
                        />
                    </td>
                    <td className="p-2">
                        <input 
                            type="number"
                            className="w-full p-1 border rounded"
                            value={pos.salary_grade} 
                            onChange={(e) => handlePositionChange(index, 'salary_grade', e.target.value)} 
                        />
                    </td>
                </tr>
            );
        });
    };

    return (
        <div className="max-w-4xl mx-auto mt-8 px-4"> {/* Increased width for the table */}
            <div className="mb-6 p-4 bg-slate-50 border-l-4 border-slate-400 rounded-r-lg shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Logged-in Agency</span>
                <h2 className="text-lg font-semibold text-slate-800">{entityName}</h2>
            </div>
            <h1 className="text-2xl font-bold mb-6 text-gray-800">
                {isEditing ? 'Edit Form 204' : 'Create Form 204'}
            </h1>

            {error && (
                <div className="bg-red-100 text-red-700 p-3 rounded mb-4 border border-red-200">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border">
                <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700">Fiscal Year</label>
                    <input 
                        name="fiscal_year" 
                        type="number"
                        value={formData.fiscal_year} 
                        onChange={handleHeaderChange} 
                        className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        required
                    />
                </div>

                <div className="mt-6 space-y-8">
                    <label className="block text-sm font-bold mb-2 text-gray-700 uppercase tracking-wide">
                        Position Details
                    </label>

                    {/* UNASSIGNED SECTION - Keep as is but use renderPositionRow */}
                    <div className="space-y-2">
                        <div className="bg-amber-600 text-white px-4 py-2 rounded-t-lg font-bold text-xs">
                            NEW ENTRIES (UNASSIGNED)
                        </div>
                        <table className="w-full text-sm text-left border table-fixed">
                            <TableHeader />
                            <tbody>{renderUnassignedRows()}</tbody>
                        </table>
                    </div>

                    {/* TIER 1 SECTION */}
                    <div className="mt-10">
                        <h3 className="text-sm font-black text-blue-800 border-b-2 border-blue-600 pb-1 mb-2">
                            TIER 1: ONGOING PROGRAMS
                        </h3>
                        {renderTierGroups(1)}
                    </div>

                    {/* TIER 2 SECTION */}
                    <div className="mt-10">
                        <h3 className="text-sm font-black text-emerald-800 border-b-2 border-emerald-600 pb-1 mb-2">
                            TIER 2: NEW PROPOSALS
                        </h3>
                        {renderTierGroups(2)}
                    </div>
                </div>

                <button 
                    type="button" 
                    onClick={addRow}
                    className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                >
                    <span className="text-lg">+</span> Add Position Row
                </button>


                <div className="pt-4 border-t space-y-4">
                    <div>
                        <label className="block text-sm font-semibold mb-1 text-gray-700">Digital Signature</label>
                        <input
                            name="digital_signature"
                            type="text"
                            value={formData.digital_signature}
                            onChange={handleHeaderChange}
                            placeholder="Type full name as signature"
                            className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-all shadow-sm"
                        >
                            {isLoading ? 'Saving...' : isEditing ? 'Update Summary' : 'Submit Form 204'}
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push('/forms/staff')}
                            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </form>
        </div>
    )
}