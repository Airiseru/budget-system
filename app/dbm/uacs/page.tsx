import BackButton from '@/components/ui/BackButton'
import { loadUacsDashboard } from '@/src/actions/uacs'
import { UacsTable } from '@/components/ui/dbm/UacsTable'

export default async function DbmUacsPage() {
    const { fundingSources, locations, objectCodes } = await loadUacsDashboard()

    return (
        <main className="m-6 space-y-6 max-w-7xl md:mx-auto md:my-12">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Manage UACS Codes</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Create, update, and inactivate UACS codes with cascade support.
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <UacsTable
                fundingSources={fundingSources}
                locations={locations}
                objectCodes={objectCodes}
            />
        </main>
    )
}
