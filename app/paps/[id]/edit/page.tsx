import PapForm from '@/components/ui/PapForm'
import { createPapRepository } from '@/src/db/factory'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic';
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function EditPapPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const pap = await PapRepository.getPapById(id)
    if (!pap) notFound()
    return <PapForm pap={pap} />
}