"use client"

import React, { useState } from 'react';
import { Plus, Trash2, Save, Send, X, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { z } from "zod";
import { RetireeRowSchema, BP205Schema } from '@/src/lib/validations/retiree.schema';

type RetireeRow = z.infer<typeof RetireeRowSchema>;

interface RetireeFormInitialData {
  id: string;
  fiscal_year: number;
  is_mandatory: boolean;
  entity_id: string;
  auth_status: string | null;
  retirees: {
    id: string;
    name: string;
    is_gsis_member: boolean;
    retirement_law: string;
    position: string;
    salary_grade: number;
    date_of_birth: Date; // Note: Date object from DB
    original_appointment: Date;
    retirement_effectivity: Date;
    highest_monthly_salary: number | string;
    number_vacation_leave: number | null;
    number_sick_leave: number | null;
    total_credible_service: number | null;
    number_gratuity_months: number | null;
    retirees_list_id: string;
  }[];
}

interface Props {
  retireeData?: RetireeFormInitialData; // Use the interface here
  userId: string
  entityId: string;
  entityName: string;
}

const BP205EntryGrid = ({ retireeData, userId, entityId, entityName }: Props) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [submitAction, setSubmitAction] = useState<'draft' | 'pending_personnel'>('draft');
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!retireeData

  const [retirees, setRetirees] = useState<RetireeRow[]>(() => {
    // Check if we are in "Edit Mode" via the retiree prop
    if (retireeData && retireeData.retirees && retireeData.retirees.length > 0) {
        return retireeData.retirees.map((r) => ({
            ...r,
            // 1. Convert DB Timestamps/Dates to YYYY-MM-DD for HTML inputs
            date_of_birth: r.date_of_birth ? new Date(r.date_of_birth).toISOString().split('T')[0] : "",
            original_appointment: r.original_appointment ? new Date(r.original_appointment).toISOString().split('T')[0] : "",
            retirement_effectivity: r.retirement_effectivity ? new Date(r.retirement_effectivity).toISOString().split('T')[0] : "",
            
            // 2. Ensure numbers are actual numbers (Kysely numeric types can return as strings)
            salary_grade: Number(r.salary_grade),
            highest_monthly_salary: Number(r.highest_monthly_salary),
            number_vacation_leave: Number(r.number_vacation_leave ?? 0),
            number_sick_leave: Number(r.number_sick_leave ?? 0),
            total_credible_service: Number(r.total_credible_service ?? 0),
            number_gratuity_months: Number(r.number_gratuity_months ?? 0),
        }));
    }

    // Default Row for "Create Mode"
    return [{
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
        number_vacation_leave: 0,
        number_sick_leave: 0,
        total_credible_service: 0,
        number_gratuity_months: 0,
    }];
});

  const [fiscalYear, setFiscalYear] = useState(2026);

  const handleInputChange = (id: string, field: string, value: any) => {
    setRetirees((prev: any) => prev.map((r: any) => r.id === id ? { ...r, [field]: value } : r));
  };

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
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
      userId,
      entityId,
      listData: {
        fiscal_year: fiscalYear,
        is_mandatory: true,
      },
      retirees: validation.data.retirees,
      auth_status: submitAction
    };

    const endpoint = isEditing ? `/api/retirees/${retireeData.id}` : '/api/retirees';
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
        const endpoint = data.formId ? `/forms/retirees/${data.formId}` : '/forms/retirees'
        router.push(endpoint)
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
      highest_monthly_salary: 0,
      number_vacation_leave: 0,
      number_sick_leave: 0,
      total_credible_service: 0,
      number_gratuity_months: 0
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
    <div>
      <div className="mb-6 p-4 bg-muted/50 border-l-4 border-muted-400 rounded-r-lg shadow-sm">
          <span className="text-xs font-bold text-muted-500 uppercase tracking-widest">Logged-in Agency</span>
          <h2 className="text-lg font-semibold text-muted-800">{entityName}</h2>
      </div>
      <h1 className="text-2xl font-bold mb-6 text-primary-800">
          {isEditing ? 'Edit Form 205' : 'Create Form 205'}
      </h1>
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {error && <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">{error}</div>}

        <div className="flex justify-between items-center bg-muted/50 p-3 border rounded-t-lg">
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 bg-primary-foreground text-primary px-3 py-1.5 rounded text-sm hover:opacity-90 transition-all"
            >
              <Plus size={16} /> Add Row
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              onClick={() => setSubmitAction('draft')}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent-foreground text-primary px-4 py-2 disabled:opacity-50 hover:bg-accent-foreground/80 transition-all border rounded-md "
            >
              <Save size={16} />
              {isLoading && submitAction === 'draft' ? 'Saving...' : 'Save Draft'}
            </button>
            
            <button
              type="submit"
              onClick={() => setSubmitAction('pending_personnel')}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-secondary-foreground text-primary disabled:opacity-50 hover:bg-secondary-foreground/80 transition-all"
            >
              <Send size={16} />
              {isLoading && submitAction === 'pending_personnel' ? 'Submitting...' : 'Finalize & Submit'}
            </button>

            <button
                type="button"
                onClick={() => router.push('/forms/retirees')}
                className="bg-muted-200 px-4 py-2 disabled:opacity-50 hover:bg-primary-100 transition-all text-sm rounded-md hover:bg-muted/80 transition-all"
            >
                Cancel
            </button>
          </div>
        </div>

        {/* Spreadsheet Grid */}
        <div className="border border-border rounded-b-lg overflow-x-auto bg-card shadow-sm">
          <table className="w-full text-sm border-collapse min-w-[1500px]">
            <thead className="bg-muted/50 border-b text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
              <tr className="bg-muted/50 border-b text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                <th className="p-2 border-r w-10 text-center">#</th>
                <th className="p-2 border-r text-left w-64">Full Name</th>
                <th className="p-2 border-r text-center w-16">GSIS?</th>
                <th className="p-2 border-r text-left w-24">Ret. Law</th>
                <th className="p-2 border-r text-left w-40">Position</th>
                <th className="p-2 border-r text-center w-12">SG</th>
                <th className="p-2 border-r text-center w-32">DOB</th>
                <th className="p-2 border-r text-center w-32">Orig. Appt</th>
                <th className="p-2 border-r text-center w-32">Effectivity</th>
                <th className="p-2 border-r text-right w-32">Monthly Sal.</th>
                <th className="p-2 border-r text-center w-20">VL Credits</th>
                <th className="p-2 border-r text-center w-20">SL Credits</th>
                <th className="p-2 border-r text-center w-24">Total Credible Service</th>
                <th className="p-2 border-r text-center w-24">No. of Gratuity Months</th>
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
                      className="w-full p-1.5 bg-transparent focus:ring-1 focus:ring-ring outline-none" 
                      value={row.name} 
                      placeholder='DELA CRUZ, JUAN, R.'
                      onChange={(e) => handleInputChange(row.id, 'name', e.target.value)}
                    />
                  </td>
                  <td className="p-1 border-r text-center">
                    <input 
                    type="checkbox" 
                    defaultChecked={row.is_gsis_member} 
                    onChange={(e) => handleInputChange(row.id, 'is_gsis_member', e.target.checked)} 
                    className="h-4 w-4 rounded border-border bg-background accent-secondary-foreground text-primary-foreground focus:ring-ring focus:ring-offset-background"
                    />
                  </td>
                  <td className="p-1 border-r">
                    <select className="w-full p-1.5 bg-transparent focus:bg-card focus:outline-none" value={row.retirement_law} onChange={(e) => handleInputChange(row.id, 'retirement_law', e.target.value)} >
                      <option>RA 8291</option>
                      <option>RA 660</option>
                      <option>RA 1616</option>
                      <option>RA 910</option>
                    </select>
                  </td>
                  <td className="p-1 border-r">
                    <input type="text" value={row.position} className="w-full p-1.5 focus:bg-card focus:outline-none" placeholder="Administrative Officer V" onChange={(e) => handleInputChange(row.id, 'position', e.target.value)}  />
                  </td>
                  <td className="p-1 border-r">
                    <input type="number" value={row.salary_grade} min="1" max="33" className="w-full p-1.5 text-center focus:bg-card focus:outline-none" placeholder="18" onChange={(e) => handleInputChange(row.id, 'salary_grade', e.target.value)} />
                  </td>
                  <td className="p-1 border-r">
                    <input 
                      type="date" 
                      // Ensure value is YYYY-MM-DD or empty string
                      value={row.date_of_birth ? new Date(row.date_of_birth).toISOString().split('T')[0] : ''} 
                      className="w-full p-1.5 text-center focus:bg-card focus:outline-none bg-transparent" 
                      onChange={(e) => handleInputChange(row.id, 'date_of_birth', e.target.value)} 
                      required
                    />
                  </td>
                  <td className="p-1 border-r">
                    <input 
                      type="date" 
                      value={row.original_appointment ? new Date(row.original_appointment).toISOString().split('T')[0] : ''} 
                      className="w-full p-1.5 text-center focus:bg-card focus:outline-none bg-transparent" 
                      onChange={(e) => handleInputChange(row.id, 'original_appointment', e.target.value)} 
                      required
                    />
                  </td>
                  <td className="p-1 border-r">
                    <input type="date" value={row.retirement_effectivity} className="w-full p-1.5 text-center focus:bg-card focus:outline-none" onChange={(e) => handleInputChange(row.id, 'retirement_effectivity', e.target.value)} />
                  </td>
                  <td className="p-1 border-r">
                    <div className="flex items-center">
                      <span className="text-muted-400 pl-1 text-xs">₱</span>
                      <input type="number" min="0" value={row.highest_monthly_salary} onChange={(e) => handleInputChange(row.id, 'highest_monthly_salary', e.target.value)} className="w-full p-1.5 text-right focus:bg-card focus:outline-none font-mono" placeholder="0.00" />
                    </div>
                  </td>
                  <td className="p-1 border-r">
                    <input 
                      type="number"
                      min="0"
                      step="0.001"
                      value={row.number_vacation_leave} 
                      className="w-full p-1.5 text-center focus:bg-card focus:outline-none" 
                      onChange={(e) => handleInputChange(row.id, 'number_vacation_leave', e.target.value)} 
                    />
                  </td>
                  <td className="p-1 border-r">
                    <input 
                      type="number" 
                      min="0"
                      value={row.number_sick_leave} 
                      className="w-full p-1.5 text-center focus:bg-card focus:outline-none" 
                      onChange={(e) => handleInputChange(row.id, 'number_sick_leave', e.target.value)} 
                    />
                  </td>
                  <td className="p-1 border-r">
                    <input 
                      type="number" 
                      step="0.1"
                      value={row.total_credible_service} 
                      className="w-full p-1.5 text-center focus:bg-card focus:outline-none" 
                      onChange={(e) => handleInputChange(row.id, 'total_credible_service', e.target.value)} 
                    />
                  </td>
                  <td className="p-1 border-r">
                    <input 
                      type="number" 
                      value={row.number_gratuity_months} 
                      className="w-full p-1.5 text-center focus:bg-card focus:outline-none" 
                      onChange={(e) => handleInputChange(row.id, 'number_gratuity_months', e.target.value)} 
                    />
                  </td>
                  <td className="p-1 text-center">
                    <button 
                        type="button" // Important to prevent form submission
                        onClick={() => removeRow(row.id)}
                        className="text-muted-300 hover:text-red-500 transition-colors p-1"
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
        <div className="flex justify-between items-start text-xs text-muted-500 px-2">
          <p>* Ensure "Effectivity Date" falls within FY 2026 for TLP eligibility.</p>
          <div className="text-right">
              <p className="font-bold text-muted-700">Total Projected Requirement: ₱{retirees.reduce((sum: number, r: any) => sum + Number(r.highest_monthly_salary), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BP205EntryGrid;