import { redirect } from 'next/navigation'
import { sessionWithEntity } from '@/src/actions/auth'
import { createPapRepository } from '@/src/db/factory'
import AllPapView from '@/components/ui/dbm/AllPapView'

export const dynamic = 'force-dynamic'

const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

type DBMPapsSearchParams = Promise<{
    page?: string
    entityId?: string
}>

export default async function DBMPapsPage({ searchParams }: { searchParams: DBMPapsSearchParams }) {
    const session = await sessionWithEntity()

    if (!session) return redirect('/login')
    if (session.user.role !== 'dbm') return redirect('/home')

    const params = await searchParams
    const page = Number(params.page) || 1
    const limit = 15
    const offset = (page - 1) * limit
    const selectedEntityId = params.entityId || ''

    const [{ paps, totalPages }, entities] = await Promise.all([
        PapRepository.getPaginatedPaps({
            entity_id: selectedEntityId || undefined,
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
        />
    )
}
