import PapForm from '@/components/ui/PapForm'
import { createPapRepository } from '@/src/db/factory'
import { sessionWithEntity } from "@/src/actions/auth";
import { notFound, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic';

const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function EditPapPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const session = await sessionWithEntity();
    
    const pap = await PapRepository.getPapById(id)
    if (!pap) notFound()

    if (!session || !session.user?.entity_id) {
        redirect("/login");
    }

    // 3. Pass all required props to PapForm
    return (
        <PapForm 
            pap={pap} 
            entityId={session.user.entity_id} 
            entityName={session.user_entity.entity_name || "Unknown Agency"} 
        />
    )
}