import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import EntityFormListView, { type EntityFormListRow } from '@/components/ui/forms/EntityFormListView'
import { sessionWithEntity } from '@/src/actions/auth'
import { createProposalRepository } from '@/src/db/factory'
import { getActiveBudgetPrepCycle } from '@/src/lib/budget-cycle'

export const dynamic = 'force-dynamic'

const ProposalRepo = createProposalRepository(process.env.DATABASE_TYPE || 'postgres')
const PAGE_SIZE = 15

type ProposalsSearchParams = Promise<{
    page?: string
    year?: string
    status?: string
    type?: string
    search?: string
}>

type ProposalSummary = {
    id: string
    type: '202' | '203'
    proposal_year: number
    priority_rank: number
    auth_status: string | null
    title: string
    total_proposal_currency: string
    total_proposal_cost: number
    is_infrastructure: boolean
    submission_date: Date | string | null
}

const buttonStyles = "rounded-lg hover:bg-secondary-foreground hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"

function formatAmount(currency: string, amount: number) {
    return `${currency} ${Number(amount ?? 0).toLocaleString('en-PH')}`
}

function paginate<T>(rows: T[], page: number) {
    return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

export default async function ProposalsPage({
    searchParams,
}: {
    searchParams: ProposalsSearchParams
}) {
    const session = await sessionWithEntity()
    if (!session) return redirect('/login')

    try {
        const params = await searchParams
        const activeCycle = await getActiveBudgetPrepCycle()
        const lockedYear = activeCycle?.fiscal_year
        const selectedYear = params.year ? Number(params.year) : undefined
        const selectedStatus = params.status ?? ''
        const selectedType = params.type ?? ''
        const selectedSearch = params.search ?? ''
        const page = Math.max(Number(params.page) || 1, 1)
        const viewingYear = lockedYear ?? selectedYear

        const allRows = await ProposalRepo.getAllProposalSummaries(
            session.user_entity.entity_type ?? '',
            session.user.role ?? '',
            session.user.entity_id ?? '',
            viewingYear,
        ) as ProposalSummary[]

        const allYearsRows = lockedYear
            ? allRows
            : await ProposalRepo.getAllProposalSummaries(
                session.user_entity.entity_type ?? '',
                session.user.role ?? '',
                session.user.entity_id ?? '',
            ) as ProposalSummary[]

        const availableYears = Array.from(
            new Set(allYearsRows.map((proposal) => proposal.proposal_year)),
        ).sort((a, b) => b - a)

        const filteredRows = allRows.filter((proposal) => {
            if (selectedStatus && proposal.auth_status !== selectedStatus) return false
            if (selectedType && proposal.type !== selectedType) return false
            if (selectedSearch && !proposal.title.toLowerCase().includes(selectedSearch.toLowerCase())) return false
            return true
        })

        const totalPages = Math.max(Math.ceil(filteredRows.length / PAGE_SIZE), 1)
        const safePage = Math.min(page, totalPages)
        const visibleRows: EntityFormListRow[] = paginate(filteredRows, safePage).map((proposal) => ({
            id: proposal.id,
            href: `/forms/proposals/${proposal.id}`,
            title: proposal.title,
            subtitle: `Priority Rank #${proposal.priority_rank}`,
            fiscalYear: proposal.proposal_year,
            status: proposal.auth_status ?? 'draft',
            updatedAt: proposal.submission_date,
            amountLabel: formatAmount(proposal.total_proposal_currency, proposal.total_proposal_cost),
            detailLabel: proposal.is_infrastructure ? 'Infrastructure project' : 'Non-infrastructure project',
            typeLabel: `BP Form ${proposal.type}`,
        }))

        const canCreate =
            session.user.access_level === 'encode' &&
            activeCycle?.current_phase === 'preparation'
        const shouldShowBudgetPrepBanner =
            session.user.access_level === 'encode' && !canCreate

        return (
            <>
                <EntityFormListView
                    title="Budget Proposals"
                    description="Manage BP Form 202/203 project proposals for your entity."
                    basePath="/forms/proposals"
                    rows={visibleRows}
                    page={safePage}
                    totalPages={totalPages}
                    selectedYear={selectedYear}
                    selectedStatus={selectedStatus}
                    selectedType={selectedType}
                    selectedSearch={selectedSearch}
                    availableYears={availableYears}
                    activeYear={lockedYear}
                    phaseNotice={shouldShowBudgetPrepBanner ? (
                        <span>The phase to create new proposals is closed. Please wait for further announcements from DBM.</span>
                    ) : null}
                    typeOptions={[
                        { value: '202', label: 'BP Form 202 (Local)' },
                        { value: '203', label: 'BP Form 203 (Foreign)' },
                    ]}
                    createActions={canCreate ? (
                        <>
                            <Link href="/forms/proposals/new?type=202">
                                <Button variant="outline" className={buttonStyles}>New BP 202</Button>
                            </Link>
                            <Link href="/forms/proposals/new?type=203">
                                <Button variant="outline" className={buttonStyles}>New BP 203</Button>
                            </Link>
                        </>
                    ) : null}
                    secondaryActions={ canCreate && (
                        <Link href="/forms/proposals/rank">
                            <Button variant="outline" className={buttonStyles} disabled={!canCreate}>
                                Change Priority Ranks
                            </Button>
                        </Link>
                    )}
                />
            </>
        )
    } catch (error) {
        console.error(error)
        return (
            <div className="m-4">
                <h1 className="font-bold text-red-500">Error loading Proposals</h1>
                <p>Verify that the <code>project_proposals</code> table is accessible.</p>
            </div>
        )
    }
}
