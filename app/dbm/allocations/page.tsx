import AllocationDashboard from '@/components/ui/dbm/AllocationDashboard'
import { loadDbmAllocationDashboard } from '@/src/actions/budgetAllocations'

export const dynamic = 'force-dynamic'

type AllocationSearchParams = Promise<{
    year?: string
    departmentId?: string
    papId?: string
    expenseClass?: string
    search?: string
    includeDbmRejectedLineItems?: string
    includeRejectedPaps?: string
    page?: string
}>

export default async function DbmAllocationsPage({
    searchParams,
}: {
    searchParams: AllocationSearchParams
}) {
    const params = await searchParams
    const selectedYear = params.year ? Number(params.year) : undefined
    const selectedPage = params.page ? Number(params.page) : 1
    const dashboard = await loadDbmAllocationDashboard({
        selectedYear: Number.isFinite(selectedYear) ? selectedYear : undefined,
        selectedDepartmentId: params.departmentId || undefined,
        selectedPapId: params.papId || undefined,
        selectedExpenseClass: params.expenseClass as 'PS' | 'MOOE' | 'CO' | 'FINEX' | undefined,
        search: params.search || '',
        page: Number.isFinite(selectedPage) ? selectedPage : 1,
        includeDbmRejectedLineItems:
            params.includeDbmRejectedLineItems === 'true' ||
            params.includeRejectedPaps === 'true',
    })

    return (
        <AllocationDashboard
            activeCycle={dashboard.activeCycle}
            viewingYear={dashboard.viewingYear}
            availableYears={dashboard.availableYears}
            yearLockedToActivePreparation={dashboard.yearLockedToActivePreparation}
            rows={dashboard.rows}
            overallTotals={dashboard.overallTotals}
            filteredTotals={dashboard.filteredTotals}
            hierarchySummaries={dashboard.hierarchySummaries}
            departments={dashboard.departments}
            paps={dashboard.paps}
            entities={dashboard.entities}
            items={dashboard.items}
            fundingSources={dashboard.fundingSources}
            page={dashboard.page}
            totalPages={dashboard.totalPages}
            selectedDepartmentId={dashboard.selectedDepartmentId}
            selectedPapId={dashboard.selectedPapId}
            selectedExpenseClass={dashboard.selectedExpenseClass}
            search={dashboard.search}
            includeDbmRejectedLineItems={dashboard.includeDbmRejectedLineItems}
            isFiltered={dashboard.isFiltered}
            signoff={dashboard.signoff}
        />
    )
}
