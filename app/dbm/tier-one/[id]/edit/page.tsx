import { notFound } from 'next/navigation'
import { TierOneAllocationManager } from '@/components/ui/dbm/TierOneAllocationManager'
import { loadTierOneAllocation } from '@/src/actions/budgetAllocations'

export const dynamic = 'force-dynamic'

export default async function EditTierOneAllocationPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const dashboard = await loadTierOneAllocation(id)

    if (!dashboard) {
        notFound()
    }

    return (
        <TierOneAllocationManager
            activeCycle={dashboard.activeCycle}
            entities={dashboard.entities}
            paps={dashboard.paps}
            items={dashboard.items}
            fundingSources={dashboard.fundingSources}
            allocations={dashboard.allocations}
            mode="edit"
            initialValues={dashboard.allocation}
        />
    )
}
