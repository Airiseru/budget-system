import { notFound, redirect } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import { loadBudgetCycle } from '@/src/actions/budgetSettings'
import { sessionDetails } from '@/src/actions/auth'
import { EditBudgetCycleForm } from '@/components/ui/dbm/EditBudgetCycleForm'

export default async function EditBudgetCyclePage({
    params,
}: {
    params: Promise<{ fiscal_year: string }>
}) {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    const isAdmin = session.user.role === 'admin'
    const isDbmApprover = session.user.role === 'dbm' && session.user.access_level === 'approve'

    if (!isAdmin && !isDbmApprover) {
        redirect('/home')
    }

    const { fiscal_year } = await params
    const fiscalYear = Number(fiscal_year)
    if (!Number.isInteger(fiscalYear)) notFound()

    const cycle = await loadBudgetCycle(fiscalYear)
    if (!cycle) notFound()

    return (
        <main className="m-6 space-y-6 max-w-3xl md:mx-auto md:my-12">
            <div className="grid grid-cols-[73px_1fr_73px] items-center">
                <BackButton url="/dbm/settings/cycles" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Edit Budget Cycle</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Re-open a previous phase or update the legal basis reference.
                    </p>
                </div>
                <div />
            </div>

            <EditBudgetCycleForm cycle={cycle} />
        </main>
    )
}
