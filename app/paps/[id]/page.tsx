import { createPapRepository } from '@/src/db/factory'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PapDeleteButton from '@/components/ui/PapDeleteButton'

export const dynamic = 'force-dynamic';
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function PapPage({
    params
}: {
    params: { id: string }
}) {
    const { id } = await params
    const pap = await PapRepository.getPapById(id)
    if (!pap) notFound()

    return (
        <div className="max-w-lg mx-auto mt-8">
            <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{pap.title}</h1>
            <div className="flex gap-2">
                <Link
                    href={`/paps/${pap.id}/edit`}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                    Edit
                </Link>
                <PapDeleteButton id={pap.id} />
                <Link
                    href="/paps"
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded"
                >
                    Back
                </Link>
            </div>
            </div>

            <div className="space-y-4">
            <div>
                <label className="text-sm font-medium text-gray-500">Description</label>
                <p>{pap.description}</p>
            </div>
            <div>
                <label className="text-sm font-medium text-gray-500">Project Status</label>
                <p>{pap.project_status}</p>
            </div>
            </div>
        </div>
    )
}