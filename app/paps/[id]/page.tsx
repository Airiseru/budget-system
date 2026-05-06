import { notFound } from 'next/navigation'
import PapView from '@/components/ui/PapView'
import { createPapRepository } from '@/src/db/factory'

export default async function PapPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    
    const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres');
    
    const [pap, relatedForms] = await Promise.all([
        PapRepository.getPapWithEntityDetailsById(id),
        PapRepository.getFormsByPapId(id)
    ]);

    if (!pap) {
        notFound();
    }

    return <PapView pap={pap} relatedForms={relatedForms || []} />;
}
