import Link from 'next/link'
import PapDeleteButton from '@/components/ui/PapDeleteButton'
import { ArrowLeft, Pencil } from '@/components/ui/Icons'

// Define interfaces for your data
interface Pap {
    id: string;
    title: string;
    tier: string | number;
    category: string;
    project_status: string;
    description: string | null;
}

interface RelatedForm {
    id: string;
    type: string;
    created_at: string | Date;
    auth_status: string | null;
}

export default function PapView({ pap, relatedForms }: { pap: Pap, relatedForms: RelatedForm[] }) {
    return (
        <div className="max-w-2xl mx-auto mt-8 mb-12">
            {/* TOP NAVIGATION */}
            <div className="flex justify-between items-center mb-6">
                <Link 
                    href="/paps" 
                    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to List
                </Link>

                <Link 
                    href={`/paps/${pap.id}/edit`}
                    className="flex items-center gap-2 bg-secondary-foreground hover:bg-secondary-foreground/80 text-white px-4 py-2 rounded-md text-sm font-semibold transition-all shadow-sm"
                >
                    <Pencil size={14} />
                    Edit PAP
                </Link>
            </div>

            <div className="bg-white shadow-sm border rounded-xl overflow-hidden">
                {/* PAP HEADER */}
                <div className="p-6 border-b bg-gray-50/50">
                    <h1 className="text-xl font-bold text-gray-900">{pap.title}</h1>
                    <p className="text-sm text-gray-500 mt-1 uppercase tracking-wider font-medium">
                        Tier {pap.tier} • {pap.category}
                    </p>
                </div>

                <div className="p-6 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">PAP ID (UUID)</label>
                            <p className="font-mono text-xs break-all text-gray-600 bg-gray-50 p-2 rounded border">{pap.id}</p>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">Status</label>
                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${
                                pap.project_status === 'draft' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'
                            }`}>
                                {pap.project_status}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 block mb-1">Description</label>
                        <p className="text-gray-700 leading-relaxed">{pap.description}</p>
                    </div>

                    {/* Associated Forms */}
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                            Associated Budget Forms
                            <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">
                                {relatedForms.length}
                            </span>
                        </h2>
                        
                        {relatedForms.length > 0 ? (
                            <div className="grid gap-3">
                                {relatedForms.map((form) => (
                                    <Link 
                                        key={form.id} 
                                        href={`/forms/staff/${form.id}`}
                                        className="group block p-4 border rounded-lg hover:border-accent-foreground transition-all"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="text-sm font-bold group-hover:text-secondary-foreground">Form {form.type}</span>
                                                <p className="text-[10px] text-gray-400 font-mono mt-0.5">{new Date(form.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                            </div>
                                            <div className="text-right flex flex-col">
                                                <p className="text-xs text-gray-400">Status:</p>
                                                <p className="text-xs font-medium text-gray-600">
                                                    {form.auth_status === 'approved' ? 'Approved' : 'Pending'}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-gray-50">
                                <p className="text-sm text-gray-400 italic">No forms linked to this PAP.</p>
                            </div>
                        )}
                    </div>

                    {/* DANGER ZONE */}
                    <div className="pt-6 border-t mt-12">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Danger Zone</h3>
                                <p className="text-xs text-gray-500">Irreversible actions for this PAP record.</p>
                            </div>
                            {/* This component STILL has 'use client' inside its own file */}
                            <PapDeleteButton id={pap.id} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}