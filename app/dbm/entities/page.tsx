import { loadEntities } from "@/src/actions/entities"
import { EntityManagementTable } from '@/components/ui/dbm/EntityManagementTable'
import NewEntityButton from '@/components/ui/dbm/NewEntityButton'
import BackButton from "@/components/ui/BackButton"
import PaginationControls from '@/components/ui/PaginationControls'
import EntityFilters from '@/components/ui/dbm/EntityFilters'

const PAGE_SIZE = 8

type EntitiesSearchParams = Promise<{
    page?: string
    department?: string
}>

export default async function EntitiesPage({ searchParams }: { searchParams: EntitiesSearchParams }) {
    const params = await searchParams
    const page = Math.max(Number(params.page) || 1, 1)
    const selectedDepartmentId = params.department ?? ''
    const result = await loadEntities()

    if (!('departments' in result) || !result.departments || !result.agencies || !result.operatingUnits) {
        return (
            <main className="m-4">
                <p className="text-muted-foreground">Unable to load entities.</p>
            </main>
        )
    }

    const { departments, agencies, operatingUnits, entityName } = result
    const departmentOptions = departments.map((department) => ({
        value: department.id,
        label: `${department.uacs_code} • ${department.name}`,
    }))

    const filteredDepartments = selectedDepartmentId
        ? departments.filter((department) => department.id === selectedDepartmentId)
        : departments
    const totalPages = Math.max(Math.ceil(filteredDepartments.length / PAGE_SIZE), 1)
    const safePage = Math.min(page, totalPages)
    const paginatedDepartments = selectedDepartmentId
        ? filteredDepartments
        : filteredDepartments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    const visibleDepartmentIds = new Set(paginatedDepartments.map((department) => department.id))
    const visibleAgencies = selectedDepartmentId || departments.length > 0
        ? agencies.filter((agency) => agency.department_id ? visibleDepartmentIds.has(agency.department_id) : !selectedDepartmentId && safePage === 1)
        : agencies
    const visibleAgencyIds = new Set(visibleAgencies.map((agency) => agency.id))
    const visibleOperatingUnits = selectedDepartmentId || departments.length > 0
        ? operatingUnits.filter((unit) => visibleAgencyIds.has(unit.agency_id))
        : operatingUnits

    const getPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (selectedDepartmentId) next.set('department', selectedDepartmentId)
        if (targetPage > 1) next.set('page', String(targetPage))
        const query = next.toString()
        return query ? `/dbm/entities?${query}` : '/dbm/entities'
    }

    return (
        <main className="min-h-screen bg-background px-4 py-8">
            <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm" />

                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">Manage Entities</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Managing entities under <span className="font-medium underline">{entityName}</span>
                    </p>
                </div>

                <NewEntityButton basePath="/dbm/entities" />
            </div>

            <EntityFilters
                basePath="/dbm/entities"
                departmentOptions={departmentOptions}
                selectedDepartmentId={selectedDepartmentId}
            />

            <EntityManagementTable
                departments={paginatedDepartments}
                agencies={visibleAgencies}
                operatingUnits={visibleOperatingUnits}
                entityName={entityName}
                basePath="/dbm/entities"
            />

            <PaginationControls
                page={safePage}
                totalPages={totalPages}
                getPageHref={getPageHref}
            />
            </div>
        </main>
    )
}
