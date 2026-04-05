import { notFound } from 'next/navigation'
import PapView from '@/components/ui/PapView'
import { createPapRepository } from '@/src/db/factory'

export default async function PapPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    
    // Initialize repository (Server-side only)
    const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres');
    
    // Fetch data
    const [pap, relatedForms] = await Promise.all([
        PapRepository.getPapById(id),
        PapRepository.getFormsByPapId(id)
    ]);

    if (!pap) {
        notFound();
    }

    // Pass data to the View component
    return <PapView pap={pap} relatedForms={relatedForms || []} />;
}