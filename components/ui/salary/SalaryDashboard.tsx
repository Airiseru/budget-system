'use client'

import { useState } from 'react'
import { SalaryScheduleTable } from './SalaryScheduleTable'
import { CompensationRulesTable } from './CompensationRulesTable'
import { NewSalaryScheduleForm } from './SalaryForm'
import { NewCompensationRuleForm } from './CompensationForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, TableProperties, Receipt } from 'lucide-react'

type Tab = 'salary' | 'compensation'
type Modal = null | 'new-salary' | 'new-compensation'

type Props = {
    schedule: any | null
    compensationRules: any[]
}

export function SalaryDashboard({ schedule, compensationRules }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('salary')
    const [modal, setModal] = useState<Modal>(null)

    return (
        <div className="space-y-6">
            {/* tab bar + actions */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex gap-1">
                    <button
                        onClick={() => setActiveTab('salary')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                            ${activeTab === 'salary'
                                ? 'bg-accent-foreground text-white'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                    >
                        <TableProperties className="h-4 w-4" />
                        Salary Schedule
                    </button>
                    <button
                        onClick={() => setActiveTab('compensation')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                            ${activeTab === 'compensation'
                                ? 'bg-accent-foreground text-white'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                    >
                        <Receipt className="h-4 w-4" />
                        Compensation Rules
                        {compensationRules.length > 0 && (
                            <Badge variant="secondary" className={`ml-1 text-xs
                                ${activeTab === 'compensation'
                                    ? 'bg-white text-accent-foreground'
                                    : 'bg-accent-foreground text-white'
                                }
                            `}>
                                {compensationRules.length}
                            </Badge>
                        )}
                    </button>
                </div>

                <Button
                    onClick={() => setModal(activeTab === 'salary' ? 'new-salary' : 'new-compensation')}
                    className="gap-2 bg-accent-foreground hover:bg-accent-foreground/90 text-white"
                >
                    <Plus className="h-4 w-4" />
                    {activeTab === 'salary' ? 'New Salary Schedule' : 'New Compensation Rule'}
                </Button>
            </div>

            {/* active tab content */}
            {activeTab === 'salary' && (
                <SalaryScheduleTable schedule={schedule} />
            )}

            {activeTab === 'compensation' && (
                <CompensationRulesTable rules={compensationRules} />
            )}

            {/* modals */}
            {modal === 'new-salary' && (
                <NewSalaryScheduleForm onClose={() => setModal(null)} />
            )}
            {modal === 'new-compensation' && (
                <NewCompensationRuleForm onClose={() => setModal(null)} />
            )}
        </div>
    )
}