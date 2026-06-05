import { redirect } from 'next/navigation'
import { sessionWithEntity } from '@/src/actions/auth'
import { createPapRepository } from '@/src/db/factory'
import AllPapView from '@/components/ui/dbm/AllPapView'
import type { PAP_PROJECT_STATUS_TYPES } from '@/src/lib/constants'

export const dynamic = 'force-dynamic'

const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

type DBMPapsSearchParams = Promise<{
    page?: string
    entityId?: string
    status?: string
}>

const PAP_STATUS_FILTERS = new Set<PAP_PROJECT_STATUS_TYPES>(['approved', 'proposed', 'rejected'])

export default async function DBMPapsPage({ searchParams }: { searchParams: DBMPapsSearchParams }) {
    const session = await sessionWithEntity()

    if (!session) return redirect('/login')
    if (session.user.role !== 'dbm') return redirect('/home')

    const params = await searchParams
    const page = Number(params.page) || 1
    const limit = 15
    const offset = (page - 1) * limit
    const selectedEntityId = params.entityId || ''
    const selectedStatus = PAP_STATUS_FILTERS.has(params.status as PAP_PROJECT_STATUS_TYPES)
        ? params.status as PAP_PROJECT_STATUS_TYPES
        : 'approved'

    const [{ paps, totalPages }, entities] = await Promise.all([
        PapRepository.getPaginatedPaps({
            entity_id: selectedEntityId || undefined,
            project_status: selectedStatus,
            limit,
            offset,
        }),
        PapRepository.getPapEntityOptions(),
    ])

    return (
        <AllPapView
            paps={paps}
            entities={entities}
            page={page}
            totalPages={totalPages}
            selectedEntityId={selectedEntityId}
            selectedStatus={selectedStatus}
        />
    )
}
