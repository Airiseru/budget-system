import { createPapRepository } from '@/src/db/factory'
import { createEntityRepository } from '@/src/db/factory'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from "@/components/ui/button-group"
import PapFilters from '@/components/ui/paps/PapFilters'
import PaginationControls from '@/components/ui/PaginationControls'
import Link from "next/link"
import { sessionDetails } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import { PAP_PROJECT_STATUS_TYPES, PAP_PROJECT_TYPE_LABELS } from '@/src/lib/constants'

export const dynamic = 'force-dynamic'

const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')
const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
const PAGE_SIZE = 15

const formatProjectStatus = (status: string | null | undefined) =>
    status
        ? status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
        : 'N/A'

const formatProjectType = (type: string | null | undefined) =>
    type && type in PAP_PROJECT_TYPE_LABELS
        ? PAP_PROJECT_TYPE_LABELS[type as keyof typeof PAP_PROJECT_TYPE_LABELS]
        : type?.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? 'N/A'

const getProjectStatusClassName = (status: string | null | undefined) => {
    switch (status) {
        case 'approved':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700'
        case 'rejected':
        case 'cancelled':
            return 'border-red-200 bg-red-50 text-red-700'
        case 'pending':
        case 'under_review':
            return 'border-amber-200 bg-amber-50 text-amber-700'
        default:
            return 'border-border bg-muted text-muted-foreground'
    }
}

type PapsSearchParams = Promise<{
    page?: string
    formType?: string
    status?: string
    search?: string
}>

const PAP_STATUS_FILTERS = new Set<PAP_PROJECT_STATUS_TYPES | 'all'>([
    'all',
    'draft',
    'proposed',
    'approved',
    'for_release',
    'terminating',
    'on_going',
    'completed',
    'rejected',
    'cancelled',
])

export default async function PapPage({
    searchParams,
}: {
    searchParams: PapsSearchParams
}) {
    const session = await sessionDetails()

    if (!session) {
        return redirect('/login')
    }

    const params = await searchParams
    const page = Math.max(1, Number(params.page) || 1)
    const formType = params.formType === '202' || params.formType === '203'
        ? params.formType
        : ''
    const selectedStatus = PAP_STATUS_FILTERS.has(params.status as PAP_PROJECT_STATUS_TYPES | 'all')
        ? params.status as PAP_PROJECT_STATUS_TYPES | 'all'
        : 'approved'
    const search = params.search?.trim() ?? ''
    const category = formType === '202'
        ? 'local'
        : formType === '203'
          ? 'foreign'
          : undefined
    const accessibleEntityIds = session.user.role === 'dbm'
        ? undefined
        : session.user.entity_id
          ? await EntityRepository.getAccessibleEntityIds(session.user.entity_id)
          : []
    const { paps, totalPages } = await PapRepository.getPaginatedPaps({
        entity_ids: accessibleEntityIds,
        category,
        project_status: selectedStatus === 'all' ? undefined : selectedStatus,
        search,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
    })

    const getPageHref = (targetPage: number) => {
        const next = new URLSearchParams()
        if (formType) next.set('formType', formType)
        if (selectedStatus !== 'approved') next.set('status', selectedStatus)
        if (search) next.set('search', search)
        next.set('page', String(targetPage))
        return `/paps?${next.toString()}`
    }

    return (
        <main className="mx-auto max-w-[1700px] space-y-6 px-4 py-8 pb-20">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <ButtonGroup>
                    <Link href="/home">
                        <Button variant="outline" aria-label="Go Back">Go Back</Button>
                    </Link>
                </ButtonGroup>
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">All PAPs</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Browse PAP records. New PAP creation is managed through DBM proposal review.
                    </p>
                </div>
                <div className="w-[92px]" />
            </div>

            <PapFilters search={search} formType={formType} status={selectedStatus} />

            {paps.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    No PAPs found.
                </div>
            ) : (
                <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                    <div className="max-h-[70vh] overflow-auto">
                        <table className="w-full min-w-[1000px] text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-primary-foreground text-sm uppercase text-white shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
                                <tr>
                                    <th className="px-4 py-3">PAP</th>
                                    <th className="px-4 py-3">Form Type</th>
                                    <th className="px-4 py-3">Applicable Entity</th>
                                    <th className="px-4 py-3">Project Type</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Full Code</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {paps.map((pap) => (
                                    <tr key={pap.id} className="transition-colors hover:bg-accent/60">
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/paps/${pap.id}`}
                                                className="font-semibold text-primary-foreground hover:underline"
                                            >
                                                {pap.title}
                                            </Link>
                                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                                {pap.description || 'No description provided.'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {pap.category === 'local' ? 'BP Form 202' : 'BP Form 203'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>{pap.entity_name ?? 'All Entities'}</div>
                                            {pap.department_name && (
                                                <div className="text-xs text-muted-foreground">{pap.department_name}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatProjectType(pap.project_type)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getProjectStatusClassName(pap.project_status)}`}>
                                                {formatProjectStatus(pap.project_status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                            {pap.full_pap_code || 'Not set'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={`/paps/${pap.id}`}
                                                className="inline-flex rounded border border-border px-3 py-2 text-sm font-semibold hover:bg-background"
                                            >
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <PaginationControls
                        page={page}
                        totalPages={totalPages}
                        getPageHref={getPageHref}
                    />
                </section>
            )}
        </main>
    )
}
