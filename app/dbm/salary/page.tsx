import { createSalaryRepository } from '@/src/db/factory'
import { sessionDetails } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import { SalaryDashboard } from '@/components/ui/salary/SalaryDashboard'
import { CompensationRule } from '@/src/types/salaries'
import BackButton from '@/components/ui/BackButton'

export const dynamic = 'force-dynamic'

const SalaryRepository = createSalaryRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function SalaryPage() {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    if (session.user.role !== 'dbm') {
        redirect('/home')
    }

    let schedule = null
    let compensationRules: CompensationRule[] = []

    try {
        schedule = await SalaryRepository.getLatestSalarySchedule()
    } catch {
        console.log("No salary schedule found")
    }

    try {
        compensationRules = await SalaryRepository.getLatestCompensationRules() ?? []
    } catch {
        console.log("No compensation rules found")
    }

    return (
        <main className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
                <div className="flex items-center justify-between">
                    <BackButton/>
                    <div className="text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Salary & Compensation</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Manage salary schedules and compensation rules
                        </p>
                    </div>
                    <div className="w-[73px]" />
                </div>

                <SalaryDashboard
                    schedule={schedule}
                    compensationRules={compensationRules}
                />
            </div>
        </main>
    )
}