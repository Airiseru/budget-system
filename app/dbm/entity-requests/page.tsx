import { requireDbm } from '@/src/actions/admin'
import { createEntityRepository } from '@/src/db/factory'
import BackButton from '@/components/ui/BackButton'
import { EntityRequestsTable } from '@/components/ui/dbm/EntityRequestsTable'

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function DbmEntityRequestsPage() {
    await requireDbm()
    const requests = await EntityRepository.getPendingEntityRequests()

    return (
        <main className="m-6 space-y-6 max-w-7xl md:mx-auto md:my-12">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Entity Requests</h1>
                    <p className="text-muted-foreground text-sm mt-1">Review pending requests from admins.</p>
                </div>
                <div className="w-[73px]" />
            </div>

            <EntityRequestsTable requests={requests} />
        </main>
    )
}
