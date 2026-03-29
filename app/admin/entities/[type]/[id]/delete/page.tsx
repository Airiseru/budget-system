import { redirect } from 'next/navigation'
import { sessionWithEntity } from '@/src/actions/auth'
import { DeleteEntityForm } from '@/components/ui/admin/DeleteEntityForm'
import BackButton from '@/components/ui/BackButton'
import { createEntityRepository } from '@/src/db/factory'

const urlToDatabaseMap: Record<string, 'department' | 'agency' | 'operating_unit'> = {
    'department': 'department',
    'agency': 'agency',
    'operating-unit': 'operating_unit'
}

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function DeleteEntityPage({
    params,
}: {
    params: { type: string; id: string }
}) {
    const session = await sessionWithEntity()
    if (!session || session.user.role !== 'admin') redirect('/admin')

    const { type: param_type, id: param_id } = await params

    const dbEntityType = urlToDatabaseMap[param_type]
    if (!dbEntityType) redirect('/admin/entities')

    // Fetch the entity so we can tell the user EXACTLY what they are deleting
    const entity = await EntityRepository.getFullEntityById(dbEntityType, param_id)
    if (!entity) redirect('/admin/entities')

    const typeLabel = param_type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

    return (
        <main className="m-6 max-w-2xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/admin/entities" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-red-600">Delete {typeLabel}</h1>
                </div>
                <div className="w-[73px]" /> 
            </div>

            <DeleteEntityForm 
                entityId={entity.id} 
                entityType={dbEntityType} 
                entityName={entity.name} 
            />
        </main>
    )
}