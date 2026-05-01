import { loadAdminEntities } from '@/src/actions/entities'
import BackButton from '@/components/ui/BackButton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { EntityManagementTable } from '@/components/ui/dbm/EntityManagementTable'

export default async function EntitiesPage() {
    const result = await loadAdminEntities()

    if (!('departments' in result) || !result.departments || !result.agencies || !result.operatingUnits) {
        return (
            <main className="m-4">
                <p className="text-muted-foreground">Unable to load entities.</p>
            </main>
        )
    }

    const { departments, agencies, operatingUnits, entityName } = result

    return (
        <main className="m-6 space-y-6 max-w-7xl md:mx-auto md:my-12">
            <div className="flex items-center justify-between">
                <BackButton url="/admin" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Entity Overview</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Viewing entities under <span className="font-medium underline">{entityName}</span>
                    </p>
                </div>
                <Button variant="outline">
                    <Link href="/admin/entities/request">Request New Entity</Link>
                </Button>
            </div>

            <EntityManagementTable
                departments={departments}
                agencies={agencies}
                operatingUnits={operatingUnits}
                entityName={entityName}
                showActions={false}
                basePath="/admin/entities"
            />
        </main>
    )
}
