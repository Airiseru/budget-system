'use client'

import { useState } from 'react'
import { useRouter } from "next/navigation"
import { StaffingSummary, NewStaffingSummary } from "@/src/types/staffing"

interface StaffingSummaryProps {
    staff?: StaffingSummary
}

export default function StaffForm({ staff }: StaffingSummaryProps) {
    const router = useRouter()
    const isEditing = !!staff

    const [formData, setFormData] = useState({
        fiscal_year: 2026,
        digital_signature: "",
        positions: [
        { pap_id: "", position_title: "", num_positions: 1, salary_grade: "", total_salary: 0 }
        ]
    });

    // Handle header changes
    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Handle specific row changes
    const handlePositionChange = (index: number, field: string, value: any) => {
        const updatedPositions = [...formData.positions];
        updatedPositions[index] = { ...updatedPositions[index], [field]: value };
        setFormData({ ...formData, positions: updatedPositions });
    };

    const addRow = () => {
        setFormData({
        ...formData,
        positions: [...formData.positions, { pap_id: "", position_title: "", num_positions: 1, salary_grade: "", total_salary: 0 }]
        });
    };
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const endpoint = isEditing ? `/api/staff/${staff.id}` : '/api/staff'
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
                router.push(`/staff/${data.id}`)
            } else {
                setError('Something went wrong')
            }
        } catch (error) {
            setError('An error occurred while creating Staffing Summary')
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
                        <p>{formData.fiscal_year}</p>
                    </div> 
                    ):(
                    <input name="fiscal_year" value={formData.fiscal_year} onChange={handleHeaderChange} />
                )
                }

                {/* Header Section */}
      <input name="fiscal_year" value={formData.fiscal_year} onChange={handleHeaderChange} />
      
        {/* Table Section */}
        <table>
            <thead>
            <tr>
                <th>PAP ID</th>
                <th>Title</th>
                <th>Qty</th>
                <th>Salary</th>
            </tr>
            </thead>
            <tbody>
            {formData.positions.map((pos, index) => (
                <tr key={index}>
                <td>
                    <input 
                    value={pos.pap_id} 
                    onChange={(e) => handlePositionChange(index, 'pap_id', e.target.value)} 
                    />
                </td>
                {/* ... other inputs ... */}
                </tr>
            ))}
            </tbody>
        </table>
        <button type="button" onClick={addRow}>Add Row</button>
            </form>
        </div>
    )
}