import { redirect } from 'next/navigation'
import { sessionWithEntity } from '@/src/actions/auth'
import { DeactivateEntityForm } from '@/components/ui/dbm/DeactivateEntityForm'
import BackButton from '@/components/ui/BackButton'
import { createEntityRepository } from '@/src/db/factory'

const urlToDatabaseMap: Record<string, 'department' | 'agency' | 'operating_unit'> = {
    'department': 'department',
    'agency': 'agency',
    'operating-unit': 'operating_unit'
}

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function DeactivateEntityPage({
    params,
}: {
    params: Promise<{ type: string; id: string }>
}) {
    const session = await sessionWithEntity()
    if (!session || session.user.role !== 'dbm') redirect('/dbm')

    const { type: param_type, id: param_id } = await params
    const dbEntityType = urlToDatabaseMap[param_type]
    if (!dbEntityType) redirect('/dbm/entities')

    const entity = await EntityRepository.getFullEntityById(dbEntityType, param_id)
    if (!entity) redirect('/dbm/entities')

    const typeLabel = param_type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

    return (
        <main className="m-6 max-w-2xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm/entities" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-red-600">Deactivate {typeLabel}</h1>
                </div>
                <div className="w-[73px]" />
            </div>

            <DeactivateEntityForm
                entityId={entity.id}
                entityType={dbEntityType}
                entityName={entity.name}
                currentStatus={entity.status}
                basePath="/dbm/entities"
            />
        </main>
    )
}
