import { TierOneAllocationManager } from '@/components/ui/dbm/TierOneAllocationManager'
import { loadTierOneDashboardForYear } from '@/src/actions/budgetAllocations'

export const dynamic = 'force-dynamic'

type TierOneSearchParams = Promise<{
    year?: string
}>

export default async function TierOnePage({ searchParams }: { searchParams: TierOneSearchParams }) {
    const params = await searchParams
    const selectedYear = params.year ? Number(params.year) : undefined
    const dashboard = await loadTierOneDashboardForYear(Number.isFinite(selectedYear) ? selectedYear : undefined)

    return (
        <TierOneAllocationManager
            activeCycle={dashboard.activeCycle}
            viewingYear={dashboard.viewingYear}
            availableYears={dashboard.availableYears}
            isViewingOnly={dashboard.isViewingOnly}
            entities={dashboard.entities}
            paps={dashboard.paps}
            items={dashboard.items}
            fundingSources={dashboard.fundingSources}
            allocations={dashboard.allocations}
        />
    )
}
