import { TierOneAllocationManager } from '@/components/ui/dbm/TierOneAllocationManager'
import { loadTierOneDashboardForYear } from '@/src/actions/budgetAllocations'

export const dynamic = 'force-dynamic'

type TierOneSearchParams = Promise<{
    year?: string
    entityId?: string
    entityMode?: string
    papCode?: string
    page?: string
}>

export default async function TierOnePage({ searchParams }: { searchParams: TierOneSearchParams }) {
    const params = await searchParams
    const selectedYear = params.year ? Number(params.year) : undefined
    const selectedPage = params.page ? Number(params.page) : 1
    const dashboard = await loadTierOneDashboardForYear({
        selectedYear: Number.isFinite(selectedYear) ? selectedYear : undefined,
        selectedEntityId: params.entityId || undefined,
        selectedEntityMode: params.entityMode === 'hierarchical' ? 'hierarchical' : 'exact',
        selectedPapCode: params.papCode || undefined,
        page: Number.isFinite(selectedPage) ? selectedPage : 1,
    })

    return (
        <TierOneAllocationManager
            activeCycle={dashboard.activeCycle}
            viewingYear={dashboard.viewingYear}
            availableYears={dashboard.availableYears}
            isViewingOnly={dashboard.isViewingOnly}
            page={dashboard.page}
            totalPages={dashboard.totalPages}
            selectedEntityId={dashboard.selectedEntityId}
            selectedEntityMode={dashboard.selectedEntityMode}
            selectedPapCode={dashboard.selectedPapCode}
            entities={dashboard.entities}
            paps={dashboard.paps}
            items={dashboard.items}
            fundingSources={dashboard.fundingSources}
            allocations={dashboard.allocations}
        />
    )
}
