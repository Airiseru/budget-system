import ProposalReviewDashboard from '@/components/ui/dbm/ProposalReviewDashboard'
import { loadDbmProposalReview } from '@/src/actions/dbmProposalReview'

export const dynamic = 'force-dynamic'

type ProposalSearchParams = Promise<{
    year?: string
    status?: string
    departmentId?: string
    agencyId?: string
    operatingUnitId?: string
    search?: string
    page?: string
}>

export default async function DbmProposalsPage({
    searchParams,
}: {
    searchParams: ProposalSearchParams
}) {
    const params = await searchParams
    const year = params.year ? Number(params.year) : undefined
    const page = params.page ? Number(params.page) : 1
    const dashboard = await loadDbmProposalReview({
        year: Number.isFinite(year) ? year : undefined,
        status: params.status || undefined,
        departmentId: params.departmentId && params.departmentId !== 'all' ? params.departmentId : undefined,
        agencyId: params.agencyId && params.agencyId !== 'all' ? params.agencyId : undefined,
        operatingUnitId: params.operatingUnitId && params.operatingUnitId !== 'all' ? params.operatingUnitId : undefined,
        search: params.search || '',
        page: Number.isFinite(page) ? page : 1,
    })

    return <ProposalReviewDashboard {...dashboard} />
}
