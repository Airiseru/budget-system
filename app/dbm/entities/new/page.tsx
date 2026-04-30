import { sessionWithEntity } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import { NewEntityForm } from '@/components/ui/admin/NewEntityForm'
import BackButton from '@/components/ui/BackButton'
import { loadEntities } from '@/src/actions/entities'

export default async function NewEntityPage() {
    const session = await sessionWithEntity()
    if (!session) redirect('/login')
    if (session.user.role !== 'dbm') redirect('/dbm')

    const canCreate = {
        department: true,
        agency: true,
        operating_unit: true,
    }

    const result = await loadEntities(false, true)
    const departments = 'departments' in result ? result.departments : []
    const agencies = 'agencies' in result ? result.agencies : []
    const operatingUnits = 'operatingUnits' in result ? result.operatingUnits : []

    return (
        <main className="m-6 max-w-2xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/entities" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">New Entity</h1>
                    <p className="text-muted-foreground text-sm mt-1">Create a new government entity</p>
                </div>
                <div className="w-[73px]" />
            </div>

            <NewEntityForm
                canCreate={canCreate}
                departments={departments}
                agencies={agencies}
                operatingUnits={operatingUnits}
            />
        </main>
    )
}
