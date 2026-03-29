import { redirect } from 'next/navigation'
import { sessionWithEntity } from '@/src/actions/auth'
import { EditEntityForm } from '@/components/ui/admin/EditEntityForm'
import BackButton from '@/components/ui/BackButton'
import { loadEntities } from '@/src/actions/entities'
import { createEntityRepository } from '@/src/db/factory'

// Maps the clean URL slug to your internal database enums
const urlToDatabaseMap: Record<string, 'department' | 'agency' | 'operating_unit'> = {
    'department': 'department',
    'agency': 'agency',
    'operating-unit': 'operating_unit'
}

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function EditEntityPage({
    params,
}: {
    params: { type: string; id: string }
}) {
    // 1. Authenticate and authorize
    const session = await sessionWithEntity()
    if (!session || session.user.role !== 'admin') redirect('/admin')

    const userEntityType = session.user_entity.entity_type

    // determine what entity types are shown
    const canCreate = {
        department: userEntityType === 'national' || !userEntityType, // national only
        agency: userEntityType !== 'agency',
        operating_unit: true,
    }

    const { type: param_type, id: param_id } = await params

    // 2. Translate the URL parameter safely
    const dbEntityType = urlToDatabaseMap[param_type]
    if (!dbEntityType) redirect('/admin/entities')

    // 3. Fetch the specific entity's current data
    const entity = await EntityRepository.getFullEntityById(dbEntityType, param_id)
    if (!entity) redirect('/admin/entities')

    // 4. Fetch the dropdown lists for the form
    const result = await loadEntities(false)
    const departments = 'departments' in result ? result.departments : []
    const agencies = 'agencies' in result ? result.agencies : []

    // Format the header nicely (e.g., "operating-unit" -> "Operating Unit")
    const typeLabel = param_type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

    return (
        <main className="m-6 max-w-2xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/admin/entities" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Edit {typeLabel}</h1>
                    <p className="text-muted-foreground text-sm mt-1">Modify entity details</p>
                </div>
                <div className="w-[73px]" /> {/* Spacer to center the title perfectly */}
            </div>

            <EditEntityForm 
                canCreate={canCreate}
                entityType={dbEntityType} 
                entity={entity} 
                departments={departments} 
                agencies={agencies} 
            />
        </main>
    )
}