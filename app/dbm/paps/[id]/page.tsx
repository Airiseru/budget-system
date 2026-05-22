import { notFound, redirect } from 'next/navigation'
import PapView from '@/components/ui/PapView'
import PapUacsEditor from '@/components/ui/dbm/PapUacsEditor'
import { createPapRepository } from '@/src/db/factory'
import { sessionWithEntity } from '@/src/actions/auth'

export const dynamic = 'force-dynamic'

export default async function DBMPapPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await sessionWithEntity()

    if (!session) return redirect('/login')
    if (session.user.role !== 'dbm') return redirect('/home')

    const { id } = await params
    const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

    const [pap, relatedForms] = await Promise.all([
        PapRepository.getPapWithEntityDetailsById(id),
        PapRepository.getFormsByPapId(id),
    ])

    if (!pap) notFound()

    return (
        <PapView
            pap={pap}
            relatedForms={relatedForms || []}
            backHref="/dbm/paps"
            editHref={`/dbm/paps/${pap.id}/edit`}
            showDelete={false}
            uacsEditor={
                <PapUacsEditor
                    pap={{
                        id: pap.id,
                        cost_structure_code: pap.cost_structure_code,
                        organizational_outcome_code: pap.organizational_outcome_code,
                        program_code: pap.program_code,
                        subprogram_code: pap.subprogram_code,
                        identifier_code: pap.identifier_code,
                        project_title_code: pap.project_title_code,
                        reserved_code: pap.reserved_code,
                    }}
                />
            }
        />
    )
}
