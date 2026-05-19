import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/ui/LogoutButton"
import { Badge } from "@/components/ui/badge"
import { getPendingUsers } from "@/src/actions/admin"
import { loadAdminEntities } from "@/src/actions/entities"
import { ENTITY_TYPE_LABELS } from "@/src/lib/constants"

const PREVIEW_LIMIT = 8

const navigation = [
    {
        href: "/admin/pending",
        title: "Pending Approvals",
        description: "Review and approve users under your entity hierarchy.",
    },
    {
        href: "/admin/entities",
        title: "Entities",
        description: "View departments, agencies, and operating units.",
    },
    {
        href: "/admin/entities/request",
        title: "Request Entity",
        description: "Request a new child entity for the hierarchy.",
    },
    {
        href: "/home",
        title: "Home",
        description: "Return to your main workspace.",
    },
]

type EntityPreviewRow = {
    id: string
    name: string
    code: string
    type: string
    status?: string
}

function formatDate(value: Date | string | null | undefined) {
    if (!value) return "No date"
    return new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(value))
}

function buildEntityPreviewRows(result: Awaited<ReturnType<typeof loadAdminEntities>>) {
    if (!("departments" in result) || !result.departments || !result.agencies || !result.operatingUnits) {
        return []
    }

    const rows: EntityPreviewRow[] = []

    for (const department of result.departments) {
        rows.push({
            id: department.id,
            name: department.name,
            code: department.uacs_code,
            type: "department",
            status: department.status,
        })

        const childAgencies = result.agencies.filter((agency) => agency.department_id === department.id)
        for (const agency of childAgencies) {
            rows.push({
                id: agency.id,
                name: agency.name,
                code: `${department.uacs_code}-${agency.uacs_code}`,
                type: "agency",
                status: agency.status,
            })

            const childOperatingUnits = result.operatingUnits.filter((unit) => unit.agency_id === agency.id)
            for (const unit of childOperatingUnits) {
                rows.push({
                    id: unit.id,
                    name: unit.name,
                    code: `${department.uacs_code}-${agency.uacs_code}-${unit.uacs_code}`,
                    type: "operating_unit",
                    status: unit.status,
                })
            }
        }
    }

    const independentAgencies = result.agencies.filter((agency) => !agency.department_id)
    for (const agency of independentAgencies) {
        rows.push({
            id: agency.id,
            name: agency.name,
            code: agency.uacs_code,
            type: "agency",
            status: agency.status,
        })

        const childOperatingUnits = result.operatingUnits.filter((unit) => unit.agency_id === agency.id)
        for (const unit of childOperatingUnits) {
            rows.push({
                id: unit.id,
                name: unit.name,
                code: `${agency.uacs_code}-${unit.uacs_code}`,
                type: "operating_unit",
                status: unit.status,
            })
        }
    }

    const orphanOperatingUnits = result.operatingUnits.filter(
        (unit) => !result.agencies.some((agency) => agency.id === unit.agency_id)
    )
    for (const unit of orphanOperatingUnits) {
        rows.push({
            id: unit.id,
            name: unit.name,
            code: unit.uacs_code,
            type: "operating_unit",
            status: unit.status,
        })
    }

    return rows.slice(0, PREVIEW_LIMIT)
}

export default async function AdminPage() {
    const [pendingUsers, entitiesResult] = await Promise.all([
        getPendingUsers(),
        loadAdminEntities(),
    ])

    const latestApprovals = [...pendingUsers]
        .sort((a, b) => new Date(b.user_created_at).getTime() - new Date(a.user_created_at).getTime())
        .slice(0, PREVIEW_LIMIT)
    const entityRows = buildEntityPreviewRows(entitiesResult)

    return (
        <main className="min-h-screen bg-background">
            <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <header className="rounded-3xl border border-border bg-accent p-6 shadow-sm">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                Administration
                            </p>
                            <h1 className="mt-2 text-3xl font-black tracking-tight text-secondary-foreground sm:text-4xl">
                                Admin Dashboard
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Manage user access and inspect the entity hierarchy within your administrative scope.
                            </p>
                        </div>
                        <LogoutButton />
                    </div>

                    <nav aria-label="Admin modules" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="rounded-2xl border border-border bg-background p-4 transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <p className="font-black text-secondary-foreground">{item.title}</p>
                                <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>
                            </Link>
                        ))}
                    </nav>
                </header>

                <section className="grid gap-6 lg:grid-cols-2">
                    <article className="rounded-3xl border border-border bg-background shadow-sm">
                        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
                            <div>
                                <h2 className="text-xl font-black text-secondary-foreground">Latest Approvals</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Newest pending user approvals in your scope.</p>
                            </div>
                            <Button variant="outline">
                                <Link href="/admin/pending">View All</Link>
                            </Button>
                        </div>
                        <div className="divide-y divide-border">
                            {latestApprovals.length > 0 ? latestApprovals.map((user) => (
                                <Link
                                    key={user.user_id}
                                    href="/admin/pending"
                                    className="block p-5 transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-black text-secondary-foreground">{user.user_name}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">{user.user_email}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {user.entity_name || "No entity"} • {user.position || "No position"}
                                            </p>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <Badge variant="outline">Pending</Badge>
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                {formatDate(user.user_created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            )) : (
                                <div className="p-8 text-center text-sm text-muted-foreground">
                                    No pending approvals right now.
                                </div>
                            )}
                        </div>
                    </article>

                    <article className="rounded-3xl border border-border bg-background shadow-sm">
                        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
                            <div>
                                <h2 className="text-xl font-black text-secondary-foreground">Entities</h2>
                                <p className="mt-1 text-sm text-muted-foreground">Hierarchy preview ordered by UACS code.</p>
                            </div>
                            <Button variant="outline">
                                <Link href="/admin/entities">View All</Link>
                            </Button>
                        </div>
                        <div className="divide-y divide-border">
                            {entityRows.length > 0 ? entityRows.map((entity) => (
                                <Link
                                    key={entity.id}
                                    href="/admin/entities"
                                    className="block p-5 transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-black text-secondary-foreground">{entity.name}</p>
                                            <p className="mt-1 font-mono text-sm text-muted-foreground">{entity.code}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 sm:justify-end">
                                            <Badge variant="secondary">
                                                {ENTITY_TYPE_LABELS[entity.type] ?? entity.type}
                                            </Badge>
                                            {entity.status ? <Badge variant="outline">{entity.status}</Badge> : null}
                                        </div>
                                    </div>
                                </Link>
                            )) : (
                                <div className="p-8 text-center text-sm text-muted-foreground">
                                    No entities found in your scope.
                                </div>
                            )}
                        </div>
                    </article>
                </section>
            </div>
        </main>
    )
}
