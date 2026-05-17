import Link from 'next/link'
import BackButton from '@/components/ui/BackButton'
import {
    completeProposalScopeAction,
} from '@/src/actions/dbmProposalReview'
import type { DbmProposalReviewRow } from '@/src/db/postgres/repositories/proposalRepository'
import { STATUS_COLOR_MAPPER, STATUS_LABELS } from '@/src/lib/constants'

type EntitySegment = {
    id: string
    name: string
    uacs_code: string
    department_id?: string | null
    agency_id?: string | null
}

type Props = {
    rows: DbmProposalReviewRow[]
    page: number
    totalPages: number
    viewingYear?: number
    availableYears: number[]
    selectedStatus: string
    selectedDepartmentId: string
    selectedAgencyId: string
    selectedOperatingUnitId: string
    search: string
    departments: EntitySegment[]
    agencies: EntitySegment[]
    operatingUnits: EntitySegment[]
}

const formatAmount = (value: number) =>
    Number(value ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

function buildHref(overrides: Record<string, string | number | undefined>, current: Props) {
    const params = new URLSearchParams()
    const values = {
        year: current.viewingYear,
        status: current.selectedStatus,
        departmentId: current.selectedDepartmentId,
        agencyId: current.selectedAgencyId,
        operatingUnitId: current.selectedOperatingUnitId,
        search: current.search,
        page: current.page,
        ...overrides,
    }

    for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === '' || value === 'all') continue
        if (key === 'page' && String(value) === '1') continue
        params.set(key, String(value))
    }

    return `/dbm/proposals${params.toString() ? `?${params.toString()}` : ''}`
}

function groupRows(rows: DbmProposalReviewRow[]) {
    const departments = new Map<string, DbmProposalReviewRow[]>()
    for (const row of rows) {
        const key = [
            row.department_id ?? 'none',
            row.department_name ?? 'No department',
            row.agency_id ?? 'none',
            row.agency_name ?? 'No agency',
            row.operating_unit_id ?? 'none',
            row.operating_unit_name ?? 'No operating unit',
        ].join('|')
        departments.set(key, [...(departments.get(key) ?? []), row])
    }
    return departments
}

export default function ProposalReviewDashboard(props: Props) {
    const groupedRows = groupRows(props.rows)
    const statuses = ['pending_dbm', 'draft', 'pending_budget']

    return (
        <main className="mx-auto max-w-[1700px] space-y-6 px-4 py-8 pb-20">
            <div className="flex items-center justify-between">
                <BackButton url="/dbm" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground">DBM Proposal Review</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Review project proposals by department, agency, and operating unit.
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <form method="get" className="rounded-lg border border-border bg-background p-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <label className="space-y-1 text-sm font-medium">
                        <span>Fiscal Year</span>
                        <select name="year" defaultValue={props.viewingYear ?? ''} className="w-full rounded border border-border bg-background px-3 py-2">
                            {props.availableYears.map((year) => (
                                <option key={year} value={year}>FY {year}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                        <span>Status</span>
                        <select name="status" defaultValue={props.selectedStatus} className="w-full rounded border border-border bg-background px-3 py-2">
                            <option value="">All</option>
                            {statuses.map((status) => (
                                <option key={status} value={status}>{STATUS_LABELS[status] ?? status}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                        <span>Department</span>
                        <select name="departmentId" defaultValue={props.selectedDepartmentId} className="w-full rounded border border-border bg-background px-3 py-2">
                            <option value="all">All departments</option>
                            {props.departments.map((department) => (
                                <option key={department.id} value={department.id}>{department.uacs_code} - {department.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                        <span>Agency</span>
                        <select name="agencyId" defaultValue={props.selectedAgencyId} className="w-full rounded border border-border bg-background px-3 py-2">
                            <option value="all">All agencies</option>
                            {props.agencies.map((agency) => (
                                <option key={agency.id} value={agency.id}>{agency.uacs_code} - {agency.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                        <span>Operating Unit</span>
                        <select name="operatingUnitId" defaultValue={props.selectedOperatingUnitId} className="w-full rounded border border-border bg-background px-3 py-2">
                            <option value="all">All operating units</option>
                            {props.operatingUnits.map((ou) => (
                                <option key={ou.id} value={ou.id}>{ou.uacs_code} - {ou.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                        <span>Search</span>
                        <input name="search" defaultValue={props.search} className="w-full rounded border border-border bg-background px-3 py-2" />
                    </label>
                </div>
                <div className="mt-4 flex items-center gap-3">
                    <button className="rounded bg-secondary-foreground px-4 py-2 text-sm font-semibold text-white">Apply Filters</button>
                    <Link href="/dbm/proposals" className="text-sm text-muted-foreground underline underline-offset-2">Clear</Link>
                </div>
            </form>

            {props.rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    No proposals match the selected filters.
                </div>
            ) : (
                [...groupedRows.entries()].map(([key, proposals]) => {
                    const [departmentId, departmentName, agencyId, agencyName, operatingUnitId, operatingUnitName] = key.split('|')
                    return (
                        <section key={key} className="overflow-hidden rounded-lg border border-border bg-background">
                            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-muted-foreground">{departmentName}</p>
                                    <h2 className="text-xl font-semibold text-secondary-foreground">{agencyName}</h2>
                                    <p className="text-sm text-muted-foreground">{operatingUnitName}</p>
                                </div>
                                {props.selectedStatus === 'pending_dbm' ? (
                                    <div className="flex flex-wrap gap-2">
                                        {departmentId !== 'none' && (
                                            <form action={completeProposalScopeAction}>
                                                <input type="hidden" name="fiscal_year" value={props.viewingYear} />
                                                <input type="hidden" name="scope_type" value="department" />
                                                <input type="hidden" name="scope_id" value={departmentId} />
                                                <button className="rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Done with department</button>
                                            </form>
                                        )}
                                        {agencyId !== 'none' && (
                                            <form action={completeProposalScopeAction}>
                                                <input type="hidden" name="fiscal_year" value={props.viewingYear} />
                                                <input type="hidden" name="scope_type" value="agency" />
                                                <input type="hidden" name="scope_id" value={agencyId} />
                                                <button className="rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Done with agency</button>
                                            </form>
                                        )}
                                        {operatingUnitId !== 'none' && (
                                            <form action={completeProposalScopeAction}>
                                                <input type="hidden" name="fiscal_year" value={props.viewingYear} />
                                                <input type="hidden" name="scope_type" value="operating_unit" />
                                                <input type="hidden" name="scope_id" value={operatingUnitId} />
                                                <button className="rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Done with OU</button>
                                            </form>
                                        )}
                                    </div>
                                ) : null}
                            </div>

                            <div className="divide-y divide-border">
                                {proposals.map((proposal) => (
                                    <article key={proposal.id} className="p-4">
                                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-lg font-semibold text-secondary-foreground">{proposal.title}</h3>
                                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_COLOR_MAPPER(proposal.auth_status ?? '')}`}>
                                                        {STATUS_LABELS[proposal.auth_status ?? ''] ?? proposal.auth_status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    BP {proposal.type} • Rank {proposal.priority_rank} • {proposal.entity_name} • {proposal.total_proposal_currency} {formatAmount(Number(proposal.total_proposal_cost))}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Link href={`/forms/proposals/${proposal.id}`} className="rounded border border-border px-3 py-2 text-sm font-semibold">View</Link>
                                                {proposal.auth_status === 'pending_dbm' ? (
                                                    <Link href={`/forms/proposals/${proposal.id}/edit`} className="rounded border border-border px-3 py-2 text-sm font-semibold">Overwrite</Link>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-4 rounded-md border border-border p-4">
                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[760px] text-sm">
                                                    <thead className="text-left text-xs uppercase text-muted-foreground">
                                                        <tr>
                                                            <th className="px-3 py-2">Component</th>
                                                            <th className="px-3 py-2">Item Catalog</th>
                                                            <th className="px-3 py-2">Fund</th>
                                                            <th className="px-3 py-2 text-right">Proposed</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border">
                                                        {proposal.components.map((component) => (
                                                            <tr key={component.id}>
                                                                <td className="px-3 py-2">{component.component_name}</td>
                                                                <td className="px-3 py-2">{component.item_name ?? 'Missing item catalog'} {component.expense_class ? `(${component.expense_class})` : ''}</td>
                                                                <td className="px-3 py-2">{component.fund_description || component.fund_code || 'Default fund source'}</td>
                                                                <td className="px-3 py-2 text-right font-mono">{component.currency} {formatAmount(Number(component.proposed_amt))}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                                                <p className="text-sm text-muted-foreground">
                                                    Accepting or rejecting this proposal requires opening the form and submitting a digital signature.
                                                </p>
                                                {proposal.auth_status === 'pending_dbm' ? (
                                                    <Link
                                                        href={`/forms/proposals/${proposal.id}`}
                                                        className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                                                    >
                                                        Open Form to Sign
                                                    </Link>
                                                ) : null}
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )
                })
            )}

            <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">Page {props.page} of {props.totalPages}</p>
                <div className="flex gap-2">
                    <Link className="rounded border border-border px-3 py-2 text-sm aria-disabled:pointer-events-none aria-disabled:opacity-40" aria-disabled={props.page <= 1} href={props.page > 1 ? buildHref({ page: props.page - 1 }, props) : '#'}>
                        Previous
                    </Link>
                    <Link className="rounded border border-border px-3 py-2 text-sm aria-disabled:pointer-events-none aria-disabled:opacity-40" aria-disabled={props.page >= props.totalPages} href={props.page < props.totalPages ? buildHref({ page: props.page + 1 }, props) : '#'}>
                        Next
                    </Link>
                </div>
            </div>
        </main>
    )
}
