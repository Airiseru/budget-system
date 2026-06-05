import { notFound, redirect } from 'next/navigation'
import PapForm from '@/components/ui/PapForm'
import { sessionWithEntity } from '@/src/actions/auth'
import { createPapRepository } from '@/src/db/factory'

export const dynamic = 'force-dynamic'

const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function EditDbmPapPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await sessionWithEntity()

    if (!session) return redirect('/login')
    if (session.user.role !== 'dbm') return redirect('/home')

    const { id } = await params
    const pap = await PapRepository.getPapById(id)
    if (!pap) notFound()

    return (
        <PapForm
            pap={pap}
            entityId={pap.entity_id}
            entityName={pap.entity_id ? 'Assigned entity PAP' : 'Applies to all entities'}
            successBasePath="/dbm/paps"
            cancelHref={`/dbm/paps/${pap.id}`}
            defaultProjectStatus="approved"
            defaultProjectType="general_administration_and_support"
            entityLockedLabel={pap.entity_id ? 'Entity ID (Locked)' : 'Entity ID (Global PAP)'}
        />
    )
}
