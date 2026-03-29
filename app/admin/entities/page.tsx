import { loadEntities } from "@/src/actions/entities"
import { EntitiesTable } from '@/components/ui/admin/EntitiesTable'
import NewEntityButton from '@/components/ui/admin/NewEntityButton'
import BackButton from "@/components/ui/BackButton"

export default async function EntitiesPage() {
    try {
        const result = await loadEntities()

        if (!('departments' in result)) {
            return (
                <main className="m-4">
                    <p className="text-muted-foreground">Unable to load entities.</p>
                </main>
            )
        }

        const { departments, agencies, operatingUnits, entityName } = result

        return (
            <main className="m-6 space-y-6 max-w-7xl md:mx-auto md:my-12 max-h-screen">
                <div className="flex items-center justify-between">
                    <BackButton url="/admin" />
                    
                    <div className="text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Manage Entities</h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Managing entities under <span className="font-medium underline">{entityName}</span>
                        </p>
                    </div>

                    <NewEntityButton />
                </div>

                <EntitiesTable
                    departments={departments}
                    agencies={agencies}
                    operatingUnits={operatingUnits}
                    entityName={entityName}
                />
            </main>
        )
    } catch (e) {
        console.error(e)
    }
}