import { requireDbm } from '@/src/actions/admin'
import { createEntityRepository } from '@/src/db/factory'
import { notFound } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import { EntityRequestReviewForm } from '@/components/ui/dbm/EntityRequestReviewForm'

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function DbmEntityRequestReviewPage({ params }: { params: Promise<{ id: string }> }) {
    await requireDbm()
    const { id } = await params
    const request = await EntityRepository.getEntityRequestById(id)

    if (!request) notFound()

    return (
        <main className="m-6 max-w-3xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/entity-requests" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Review Entity Request</h1>
                    <p className="text-muted-foreground text-sm mt-1">Approve or reject this request.</p>
                </div>
                <div className="w-[73px]" />
            </div>

            <EntityRequestReviewForm request={request} />
        </main>
    )
}
