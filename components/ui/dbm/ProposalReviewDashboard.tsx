import Link from 'next/link'
import BackButton from '@/components/ui/BackButton'
import SignedBulkRejectButton from '@/components/ui/dbm/SignedBulkRejectButton'
import ProposalReviewFilters from '@/components/ui/dbm/ProposalReviewFilters'
import PaginationControls from '@/components/ui/PaginationControls'
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

type ProposalGroup = {
    id: string
    name: string
    rows: DbmProposalReviewRow[]
}

type AgencyGroup = ProposalGroup & {
    operatingUnits: Map<string, ProposalGroup>
}

type DepartmentGroup = ProposalGroup & {
    agencies: Map<string, AgencyGroup>
}

function getOrCreateGroup<T extends ProposalGroup>(
    map: Map<string, T>,
    id: string,
    name: string,
    create: () => T,
) {
    const existing = map.get(id)
    if (existing) return existing
    const group = create()
    group.name = name
    map.set(id, group)
    return group
}

function groupRows(rows: DbmProposalReviewRow[]) {
    const departments = new Map<string, DepartmentGroup>()

    for (const row of rows) {
        const departmentId = row.department_id ?? 'none'
        const departmentName = row.department_name ?? 'No department'
        const department = getOrCreateGroup(
            departments,
            departmentId,
            departmentName,
            () => ({
                id: departmentId,
                name: departmentName,
                rows: [],
                agencies: new Map<string, AgencyGroup>(),
            }),
        )

        if (!row.agency_id) {
            department.rows.push(row)
            continue
        }

        const agencyId = row.agency_id
        const agencyName = row.agency_name ?? 'No agency'
        const agency = getOrCreateGroup(
            department.agencies,
            agencyId,
            agencyName,
            () => ({
                id: agencyId,
                name: agencyName,
                rows: [],
                operatingUnits: new Map<string, ProposalGroup>(),
            }),
        )

        if (!row.operating_unit_id) {
            agency.rows.push(row)
            continue
        }

        const operatingUnitId = row.operating_unit_id
        const operatingUnitName = row.operating_unit_name ?? 'No operating unit'
        const operatingUnit = getOrCreateGroup(
            agency.operatingUnits,
            operatingUnitId,
            operatingUnitName,
            () => ({
                id: operatingUnitId,
                name: operatingUnitName,
                rows: [],
            }),
        )

        operatingUnit.rows.push(row)
    }

    return departments
}

function BulkRejectButton({
    props,
    scopeType,
    scopeId,
    scopeName,
    label,
}: {
    props: Props
    scopeType: 'department' | 'agency' | 'operating_unit'
    scopeId: string
    scopeName: string
    label: string
}) {
    if (props.selectedStatus !== 'pending_dbm' || !props.viewingYear || scopeId === 'none') return null

    return (
        <SignedBulkRejectButton
            fiscalYear={props.viewingYear}
            scopeType={scopeType}
            scopeId={scopeId}
            scopeName={scopeName}
            label={label}
        />
    )
}

function ProposalCards({ proposals }: { proposals: DbmProposalReviewRow[] }) {
    return (
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
    )
}

export default function ProposalReviewDashboard(props: Props) {
    const groupedRows = groupRows(props.rows)
    const statusOptions = [
        { value: 'all', label: 'All statuses' },
        ...['pending_dbm', 'draft', 'pending_budget'].map((status) => ({
            value: status,
            label: STATUS_LABELS[status] ?? status,
        })),
    ]

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

            <ProposalReviewFilters
                viewingYear={props.viewingYear}
                availableYears={props.availableYears}
                selectedStatus={props.selectedStatus}
                selectedDepartmentId={props.selectedDepartmentId}
                selectedAgencyId={props.selectedAgencyId}
                selectedOperatingUnitId={props.selectedOperatingUnitId}
                search={props.search}
                departments={props.departments}
                agencies={props.agencies}
                operatingUnits={props.operatingUnits}
                statusOptions={statusOptions}
            />

            {props.rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    No proposals match the selected filters.
                </div>
            ) : (
                [...groupedRows.values()].map((department) => {
                    return (
                        <section key={department.id} className="overflow-hidden rounded-lg border border-border bg-background">
                            <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Department</p>
                                    <h2 className="text-xl font-semibold text-secondary-foreground">{department.name}</h2>
                                </div>
                                <BulkRejectButton props={props} scopeType="department" scopeId={department.id} scopeName={department.name} label="Done with department" />
                            </div>

                            {department.rows.length > 0 ? <ProposalCards proposals={department.rows} /> : null}

                            {[...department.agencies.values()].map((agency) => (
                                <div key={agency.id} className="border-t border-border">
                                    <div className="flex flex-col gap-3 bg-muted/10 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agency</p>
                                            <h3 className="text-lg font-semibold text-secondary-foreground">{agency.name}</h3>
                                        </div>
                                        <BulkRejectButton props={props} scopeType="agency" scopeId={agency.id} scopeName={agency.name} label="Done with agency" />
                                    </div>
                                    {agency.rows.length > 0 ? <ProposalCards proposals={agency.rows} /> : null}
                                    {[...agency.operatingUnits.values()].map((operatingUnit) => (
                                        <div key={operatingUnit.id} className="border-t border-border">
                                            <div className="flex flex-col gap-3 bg-background px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operating Unit</p>
                                                    <h4 className="text-base font-semibold text-secondary-foreground">{operatingUnit.name}</h4>
                                                </div>
                                                <BulkRejectButton props={props} scopeType="operating_unit" scopeId={operatingUnit.id} scopeName={operatingUnit.name} label="Done with OU" />
                                            </div>
                                            <ProposalCards proposals={operatingUnit.rows} />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </section>
                    )
                })
            )}

            <div className="overflow-hidden rounded-lg border border-border bg-background">
                <PaginationControls
                    page={props.page}
                    totalPages={props.totalPages}
                    getPageHref={(targetPage) => buildHref({ page: targetPage }, props)}
                />
            </div>
        </main>
    )
}
