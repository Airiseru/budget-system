import { notFound } from 'next/navigation'
import PapView from '@/components/ui/PapView'
import { sessionDetails } from '@/src/actions/auth'
import { createEntityRepository, createPapRepository } from '@/src/db/factory'

export default async function PapPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    
    const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres');
    const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres');
    
    const [session, pap, relatedForms] = await Promise.all([
        sessionDetails(),
        PapRepository.getPapWithEntityDetailsById(id),
        PapRepository.getFormsByPapId(id)
    ]);

    if (!session || !pap) {
        notFound();
    }

    if (session.user.role !== 'dbm') {
        const accessibleEntityIds = session.user.entity_id
            ? await EntityRepository.getAccessibleEntityIds(session.user.entity_id)
            : []

        if (!pap.entity_id || !accessibleEntityIds.includes(pap.entity_id)) {
            notFound()
        }
    }

    return <PapView pap={pap} relatedForms={relatedForms || []} />;
}
