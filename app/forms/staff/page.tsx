import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import EntityFormListView, { type EntityFormListRow } from '@/components/ui/forms/EntityFormListView'
import { sessionWithEntity } from '@/src/actions/auth'
import { createFormRepository, createStaffingRepository } from '@/src/db/factory'
import { getActiveBudgetPrepCycle } from '@/src/lib/budget-cycle'

export const dynamic = 'force-dynamic'

const StaffingRepo = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const PAGE_SIZE = 15

type StaffSearchParams = Promise<{
    page?: string
    year?: string
    status?: string
    search?: string
}>

type StaffingSummary = {
    id: string
    fiscal_year: number
    auth_status: string | null
    submission_date: Date | string | null
    parent_form_id?: string | null
}

function paginate<T>(rows: T[], page: number) {
    return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

export default async function StaffingPage({
    searchParams,
}: {
    searchParams: StaffSearchParams
}) {
    const session = await sessionWithEntity()
    if (!session) return redirect('/login')

    try {
        const params = await searchParams
        const activeCycle = await getActiveBudgetPrepCycle()
        const lockedYear = activeCycle?.fiscal_year
        const selectedYear = params.year ? Number(params.year) : undefined
        const selectedStatus = params.status ?? ''
        const selectedSearch = params.search ?? ''
        const page = Math.max(Number(params.page) || 1, 1)

        const data = await StaffingRepo.getAllStaffingSummaries(
            session.user_entity.entity_type ?? '',
            session.user.role ?? '',
            session.user.entity_id ?? '',
        ) as StaffingSummary[]

        const summariesWithDisplayStatus = await Promise.all(
            data.map(async (summary) => {
                const versionFamily = await FormRepo.getFormVersionFamily(summary.id)
                const latestVersion = versionFamily.forms.at(-1)
                const displayStatus = versionFamily.forms.some((form) => form.auth_status === 'approved')
                    ? 'approved'
                    : summary.auth_status

                return {
                    ...summary,
                    displayStatus,
                    latestFormId: latestVersion?.id ?? summary.id,
                    latestUpdatedAt: latestVersion?.updated_at ?? summary.submission_date,
                }
            }),
        )

        const availableYears = Array.from(
            new Set(summariesWithDisplayStatus.map((summary) => summary.fiscal_year)),
        ).sort((a, b) => b - a)

        const filteredRows = summariesWithDisplayStatus.filter((summary) => {
            if (lockedYear && summary.fiscal_year !== lockedYear) return false
            if (!lockedYear && selectedYear && summary.fiscal_year !== selectedYear) return false
            if (selectedStatus && summary.displayStatus !== selectedStatus) return false
            if (selectedSearch && !`FY ${summary.fiscal_year} Staffing Plan`.toLowerCase().includes(selectedSearch.toLowerCase())) return false
            return true
        })

        const totalPages = Math.max(Math.ceil(filteredRows.length / PAGE_SIZE), 1)
        const safePage = Math.min(page, totalPages)
        const visibleRows: EntityFormListRow[] = paginate(filteredRows, safePage).map((summary) => ({
            id: summary.id,
            href: `/forms/staff/${summary.latestFormId}`,
            title: `FY ${summary.fiscal_year} Staffing Plan`,
            subtitle: 'BP Form 204',
            fiscalYear: summary.fiscal_year,
            status: summary.displayStatus ?? 'draft',
            updatedAt: summary.latestUpdatedAt,
            amountLabel: 'Staffing summary',
            detailLabel: 'Personnel services and staffing requirements',
            typeLabel: 'BP Form 204',
        }))

        const canCreate =
            session.user.access_level === 'encode' &&
            activeCycle?.current_phase === 'preparation'
        const shouldShowBudgetPrepBanner =
            session.user.access_level === 'encode' && !canCreate

        return (
            <>
                <EntityFormListView
                    title="Staffing Submissions"
                    description="Manage BP Form 204 staffing plans for your entity."
                    basePath="/forms/staff"
                    rows={visibleRows}
                    page={safePage}
                    totalPages={totalPages}
                    selectedYear={selectedYear}
                    selectedStatus={selectedStatus}
                    selectedType=""
                    selectedSearch={selectedSearch}
                    availableYears={availableYears}
                    activeYear={lockedYear}
                    phaseNotice={shouldShowBudgetPrepBanner ? (
                        <span>The phase to create new proposals is closed. Please wait for further announcements from DBM.</span>
                    ) : null}
                    createActions={canCreate ? (
                        <Link href="/forms/staff/new">
                            <Button 
                                variant="outline"
                                className="rounded-lg hover:bg-secondary-foreground hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                Create New Staffing Form
                            </Button>
                        </Link>
                    ) : null}
                />
            </>
        )
    } catch (error) {
        return (
            <div className="m-4">
                <h1 className="font-bold text-red-500">Error loading Staffing Forms</h1>
                <p>Please check your database connection.</p>
            </div>
        )
    }
}
