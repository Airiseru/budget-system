import { redirect } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import { BudgetCycleManager } from '@/components/ui/dbm/BudgetCycleManager'
import { loadBudgetCycles } from '@/src/actions/budgetSettings'
import { sessionDetails } from '@/src/actions/auth'

export default async function BudgetCyclesPage() {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    const isAdmin = session.user.role === 'admin'
    const isDbmApprover = session.user.role === 'dbm' && session.user.access_level === 'approve'

    if (!isAdmin && !isDbmApprover) {
        redirect('/home')
    }

    const { cycles, activeCycle } = await loadBudgetCycles()

    return (
        <main className="m-6 space-y-6 max-w-6xl md:mx-auto md:my-12">
            <div className="grid grid-cols-[73px_1fr_73px] items-center">
                <BackButton url={session.user.role === 'admin' ? '/admin' : '/dbm'} />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Budget Cycles</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Control the budget preparation phase for each fiscal year.
                    </p>
                </div>
                <div />
            </div>

            <BudgetCycleManager
                cycles={cycles}
                activeCycle={activeCycle}
                canManage={isAdmin || isDbmApprover}
            />
        </main>
    )
}
