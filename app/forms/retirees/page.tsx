import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import EntityFormListView, { type EntityFormListRow } from '@/components/ui/forms/EntityFormListView'
import { sessionWithEntity } from '@/src/actions/auth'
import { createFormRepository, createRetireeRepository } from '@/src/db/factory'
import { getActiveBudgetPrepCycle } from '@/src/lib/budget-cycle'

export const dynamic = 'force-dynamic'

const RetireeRepo = createRetireeRepository(process.env.DATABASE_TYPE || 'postgres')
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const PAGE_SIZE = 15

type RetireeSearchParams = Promise<{
    page?: string
    year?: string
    status?: string
    type?: string
    search?: string
}>

type RetireeListSummary = {
    id: string
    fiscal_year: number
    is_mandatory: boolean
    auth_status: string | null
    submission_date: Date | string | null
}

function paginate<T>(rows: T[], page: number) {
    return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

export default async function RetireesPage({
    searchParams,
}: {
    searchParams: RetireeSearchParams
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

        const data = await RetireeRepo.getAllRetireeSubmissions(
            session.user_entity.entity_type ?? '',
            session.user.role ?? '',
            session.user.entity_id ?? '',
        ) as RetireeListSummary[]

        const listsWithDisplayStatus = await Promise.all(
            data.map(async (list) => {
                const versionFamily = await FormRepo.getFormVersionFamily(list.id)
                const latestVersion = versionFamily.forms.at(-1)
                const displayStatus = versionFamily.forms.some((form) => form.auth_status === 'approved')
                    ? 'approved'
                    : versionFamily.forms.some((form) => form.auth_status === 'rejected')
                        ? 'rejected'
                        : list.auth_status

                return {
                    ...list,
                    displayStatus,
                    latestFormId: latestVersion?.id ?? list.id,
                    latestUpdatedAt: latestVersion?.updated_at ?? list.submission_date,
                }
            }),
        )

        const availableYears = Array.from(
            new Set(listsWithDisplayStatus.map((list) => list.fiscal_year)),
        ).sort((a, b) => b - a)

        const filteredRows = listsWithDisplayStatus.filter((list) => {
            if (lockedYear && list.fiscal_year !== lockedYear) return false
            if (!lockedYear && selectedYear && list.fiscal_year !== selectedYear) return false
            if (selectedStatus && list.displayStatus !== selectedStatus) return false
            if (selectedType === 'mandatory' && !list.is_mandatory) return false
            if (selectedType === 'optional' && list.is_mandatory) return false
            if (selectedSearch && !`FY ${list.fiscal_year} Retiree List`.toLowerCase().includes(selectedSearch.toLowerCase())) return false
            return true
        })

        const totalPages = Math.max(Math.ceil(filteredRows.length / PAGE_SIZE), 1)
        const safePage = Math.min(page, totalPages)
        const visibleRows: EntityFormListRow[] = paginate(filteredRows, safePage).map((list) => ({
            id: list.id,
            href: `/forms/retirees/${list.latestFormId}`,
            title: `FY ${list.fiscal_year} Retiree List`,
            subtitle: 'BP Form 205',
            fiscalYear: list.fiscal_year,
            status: list.displayStatus ?? 'draft',
            updatedAt: list.latestUpdatedAt,
            amountLabel: list.is_mandatory ? 'Mandatory submission' : 'Optional update',
            detailLabel: 'Retirement benefit projections',
            typeLabel: 'BP Form 205',
        }))

        const canCreate =
            session.user.access_level === 'encode' &&
            activeCycle?.current_phase === 'preparation'
        const shouldShowBudgetPrepBanner =
            session.user.access_level === 'encode' && !canCreate

        return (
            <>
                <EntityFormListView
                    title="BP Form 205: List of Retirees"
                    description="Manage and track retirement benefit projections."
                    basePath="/forms/retirees"
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
                        { value: 'mandatory', label: 'Mandatory Submission' },
                        { value: 'optional', label: 'Optional Update' },
                    ]}
                    createActions={canCreate ? (
                        <Link href="/forms/retirees/new">
                            <Button
                                variant="outline"
                                className="rounded-lg hover:bg-secondary-foreground hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                Create New Retiree Form
                            </Button>
                        </Link>
                    ) : null}
                />
            </>
        )
    } catch (error) {
        return (
            <div className="m-4">
                <h1 className="text-xl font-bold text-red-500">System Error</h1>
                <p className="text-muted-foreground">Failed to load Retiree Forms. Please verify your database migration for BP Form 205.</p>
            </div>
        )
    }
}
