"use client"

import React, { useState } from 'react';
import { Plus, Trash2, Save, Send, X, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { z } from "zod";

// Schema for a single retiree row
const RetireeRowSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Full Name is required"),
  is_gsis_member: z.boolean(),
  retirement_law: z.string(),
  position: z.string().min(1, "Position is required"),
  salary_grade: z.coerce.number().min(1).max(33),
  date_of_birth: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Birth Date"),
  original_appointment: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Appointment Date"),
  retirement_effectivity: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid Effectivity Date"),
  highest_monthly_salary: z.coerce.number().min(0, "Salary cannot be negative"),
});

// Schema for the entire form submission
const BP205Schema = z.object({
  retirees: z.array(RetireeRowSchema).min(1, "At least one retiree must be listed"),
});

type RetireeRow = z.infer<typeof RetireeRowSchema>;

interface Props {
  entityId: string;
  initialData?: any; // For editing existing drafts
  isEditing?: boolean;
}

// interface RetireeRow {
//   id: string;
//   name: string;
//   is_gsis_member: boolean;
//   retirement_law: string;
//   position: string;
//   salary_grade: number;
//   date_of_birth: string;
//   original_appointment: string;
//   retirement_effectivity: string;
//   highest_monthly_salary: number;
//   number_vacation_leave?: number;
//   number_sick_leave?: number;
//   total_credible_service?: number;
//   number_gratuity_months?: number;
// }

const BP205EntryGrid = ({ entityId, initialData, isEditing = false }: Props) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [submitAction, setSubmitAction] = useState<'draft' | 'pending_personnel'>('draft');
  const [error, setError] = useState<string | null>(null);

  // Initialize with initialData if editing, else one empty row
  const [retirees, setRetirees] = useState<RetireeRow[]>([
    {
      id: crypto.randomUUID(),
      name: "",
      is_gsis_member: true,
      retirement_law: "RA 8291",
      position: "",
      salary_grade: 1,
      date_of_birth: "",
      original_appointment: "",
      retirement_effectivity: "",
      highest_monthly_salary: 0,
    }
  ]);

  const [fiscalYear, setFiscalYear] = useState(2026);

  const handleInputChange = (id: string, field: string, value: any) => {
    setRetirees((prev: any) => prev.map((r: any) => r.id === id ? { ...r, [field]: value } : r));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // 1. Validate the retirees array using Zod
    const validation = BP205Schema.safeParse({ retirees });

    if (!validation.success) {
      // 2. Format the error message (gets the first error found)
      const firstError = validation.error.issues[0];
      const rowNum = parseInt(firstError.path[1] as string) + 1;
      setError(`Row ${rowNum}: ${firstError.message}`);
      setIsLoading(false);
      return;
    }

    // 3. If validation passes, use validation.data (it's now cleaned/coerced)
    const payload = {
      entityId,
      listData: {
        fiscal_year: fiscalYear,
        is_mandatory: true,
      },
      retirees: validation.data.retirees,
      auth_status: submitAction
    };

    const endpoint = isEditing ? `/api/retirees/${initialData.id}` : '/api/retirees';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        router.refresh();
        router.push(`/forms/retirees/${data.formId}`);
      } else {
        const err = await response.json();
        setError(err.error || "Failed to save");
      }
    } catch (err) {
      setError("A network error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  const addRow = () => {
    setRetirees([...retirees, { 
      id: crypto.randomUUID(), 
      name: "", 
      is_gsis_member: true, 
      retirement_law: "RA 8291", 
      position: "", 
      salary_grade: 1, 
      date_of_birth: "",
      original_appointment: "",
      retirement_effectivity: "", 
      highest_monthly_salary: 0 
    }]);
  };

  const removeRow = (id: string) => {
    if (retirees.length > 1) {
      setRetirees(retirees.filter(r => r.id !== id));
    } else {
      setError("You must have at least one row.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

      <div className="flex justify-between items-center bg-slate-50 p-3 border rounded-t-lg">
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
          >
            <Plus size={16} /> Add Row
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            onClick={() => setSubmitAction('draft')}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border rounded-md hover:bg-slate-50 disabled:opacity-50"
          >
            <Save size={16} />
            {isLoading && submitAction === 'draft' ? 'Saving...' : 'Save Draft'}
          </button>
          
          <button
            type="submit"
            onClick={() => setSubmitAction('pending_personnel')}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm disabled:opacity-50"
          >
            <Send size={16} />
            {isLoading && submitAction === 'pending_personnel' ? 'Submitting...' : 'Finalize & Submit'}
          </button>

          <button
              type="button"
              onClick={() => router.push('/forms/retiree')}
              className="bg-gray-200 px-4 py-2 rounded disabled:opacity-50 hover:bg-gray-100 transition-all"
          >
              Cancel
          </button>
        </div>
      </div>

      {/* Spreadsheet Grid */}
      <div className="border rounded-b-lg overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm border-collapse min-w-[1500px]">
          <thead>
            <tr className="bg-slate-100 border-b text-[11px] uppercase tracking-wider text-slate-600 font-bold">
              <th className="p-2 border-r w-10 text-center">#</th>
              <th className="p-2 border-r text-left w-64">Full Name (Last, First, M.I.)</th>
              <th className="p-2 border-r text-center w-24">GSIS?</th>
              <th className="p-2 border-r text-left w-32">Ret. Law</th>
              <th className="p-2 border-r text-left w-48">Position Title</th>
              <th className="p-2 border-r text-center w-16">SG</th>
              <th className="p-2 border-r text-center w-40">Date of Birth</th>
              <th className="p-2 border-r text-center w-40">Original Appointment Date</th>
              <th className="p-2 border-r text-center w-40">Effectivity Date</th>
              <th className="p-2 border-r text-right w-40">Monthly Salary</th>
              <th className="p-2 text-center w-12">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
             {retirees.map((row, index) => (
               <tr key={row.id}>
                 <td className="p-2 border-r text-center">{index + 1}</td>
                 <td className="p-1 border-r">
                   <input 
                    required
                    className="w-full p-1.5" 
                    value={row.name} 
                    onChange={(e) => handleInputChange(row.id, 'name', e.target.value)}
                   />
                 </td>
                <td className="p-1 border-r text-center">
                  <input 
                  type="checkbox" 
                  defaultChecked={row.is_gsis_member} 
                  onChange={(e) => handleInputChange(row.id, 'is_gsis_member', e.target.value)} 
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                </td>
                <td className="p-1 border-r">
                  <select className="w-full p-1.5 bg-transparent focus:bg-white focus:outline-none" value={row.retirement_law} onChange={(e) => handleInputChange(row.id, 'retirement_law', e.target.value)} >
                    <option>RA 8291</option>
                    <option>RA 660</option>
                    <option>RA 1616</option>
                    <option>RA 910</option>
                  </select>
                </td>
                <td className="p-1 border-r">
                  <input type="text" value={row.position} className="w-full p-1.5 focus:bg-white focus:outline-none" placeholder="Administrative Officer V" onChange={(e) => handleInputChange(row.id, 'position', e.target.value)}  />
                </td>
                <td className="p-1 border-r">
                  <input type="number" value={row.salary_grade} className="w-full p-1.5 text-center focus:bg-white focus:outline-none" placeholder="18" onChange={(e) => handleInputChange(row.id, 'salary_grade', e.target.value)} />
                </td>
                <td className="p-1 border-r">
                  <input 
                    type="date" 
                    // Ensure value is YYYY-MM-DD or empty string
                    value={row.date_of_birth ? new Date(row.date_of_birth).toISOString().split('T')[0] : ''} 
                    className="w-full p-1.5 text-center focus:bg-white focus:outline-none bg-transparent" 
                    onChange={(e) => handleInputChange(row.id, 'date_of_birth', e.target.value)} 
                    required
                  />
                </td>
                <td className="p-1 border-r">
                  <input 
                    type="date" 
                    value={row.original_appointment ? new Date(row.original_appointment).toISOString().split('T')[0] : ''} 
                    className="w-full p-1.5 text-center focus:bg-white focus:outline-none bg-transparent" 
                    onChange={(e) => handleInputChange(row.id, 'original_appointment', e.target.value)} 
                    required
                  />
                </td>
                <td className="p-1 border-r">
                  <input type="date" value={row.retirement_effectivity} className="w-full p-1.5 text-center focus:bg-white focus:outline-none" onChange={(e) => handleInputChange(row.id, 'retirement_effectivity', e.target.value)} />
                </td>
                <td className="p-1 border-r">
                  <div className="flex items-center">
                    <span className="text-slate-400 pl-1 text-xs">₱</span>
                    <input type="number" value={row.highest_monthly_salary} onChange={(e) => handleInputChange(row.id, 'highest_monthly_salary', e.target.value)} className="w-full p-1.5 text-right focus:bg-white focus:outline-none font-mono" placeholder="0.00" />
                  </div>
                </td>
                <td className="p-1 text-center">
                   <button 
                      type="button" // Important to prevent form submission
                      onClick={() => removeRow(row.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-start text-xs text-slate-500 px-2">
        <p>* Ensure "Effectivity Date" falls within FY 2026 for TLP eligibility.</p>
        <div className="text-right">
            <p className="font-bold text-slate-700">Total Projected Requirement: ₱0.00</p>
        </div>
      </div>
    </form>
  );
};

export default BP205EntryGrid;