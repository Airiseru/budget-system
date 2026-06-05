import Link from "next/link"
import { redirect } from "next/navigation"
import DashboardHeader from "@/components/ui/DashboardHeader"
import { sessionWithEntity } from "@/src/actions/auth"
import { createBudgetSettingsRepository, createFormRepository } from "@/src/db/factory"
import { BUDGET_PHASE_LABELS, FORM_NAMES, STATUS_LABELS } from "@/src/lib/constants"
import { isActiveUser, isDbmUser, isUnverifiedUser } from "@/src/lib/user-status"

const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || "postgres")
const FormRepository = createFormRepository(process.env.DATABASE_TYPE || "postgres")
const APPROVAL_PREVIEW_LIMIT = 8

const moduleLinksByKey = {
    allocations: {
        href: "/dbm/allocations",
        title: "NEP and GAA Dashboard",
        description: "Manage DBM recommended, NEP, and GAA amounts.",
    },
    forms: {
        href: "/dbm/forms",
        title: "View All Forms",
        description: "Review submitted budget forms and version histories.",
    },
    homepageContent: {
        href: "/dbm/homepage-content",
        title: "Homepage Content",
        description: "Draft, edit, publish, and archive FAQs and announcements.",
    },
    entities: {
        href: "/dbm/entities",
        title: "Manage Entities",
        description: "Update departments, agencies, and operating units.",
    },
    entityRequests: {
        href: "/dbm/entity-requests",
        title: "Entity Requests",
        description: "Review requested entity additions and changes.",
    },
    budgetCycles: {
        href: "/dbm/settings/cycles",
        title: "Budget Cycles",
        description: "Start cycles and advance the current phase with DBM approval.",
    },
    salary: {
        href: "/dbm/salary",
        title: "Salary Schedules and Compensations",
        description: "Manage salary schedules and compensation data.",
    },
    uacs: {
        href: "/dbm/uacs",
        title: "Manage UACS Codes",
        description: "Maintain funding, object, and other relevant UACS codes.",
    },
    items: {
        href: "/dbm/items",
        title: "Manage Line Items",
        description: "Create, update, and inactivate item catalog entries.",
    },
    paps: {
        href: "/dbm/paps",
        title: "Manage PAPs",
        description: "Maintain PAP details and assign UACS segments.",
    },
    tierOne: {
        href: "/dbm/tier-one",
        title: "Tier One Allocations",
        description: "Create and update Tier One allocations.",
    },
    proposals: {
        href: "/dbm/proposals",
        title: "Review Project Proposals",
        description: "Review and evaluate new and expanded project proposals.",
    },
} as const

const moduleGroups = [
    {
        title: "General",
        modules: [
            moduleLinksByKey.homepageContent,
            moduleLinksByKey.forms,
            moduleLinksByKey.allocations,
        ],
    },
    {
        title: "Authorization",
        modules: [
            moduleLinksByKey.entities,
            moduleLinksByKey.entityRequests,
        ],
    },
    {
        title: "Budget Set Up",
        modules: [
            moduleLinksByKey.budgetCycles,
            moduleLinksByKey.salary,
            moduleLinksByKey.uacs,
            moduleLinksByKey.items,
            moduleLinksByKey.paps,
        ],
        approverOnlyModules: [moduleLinksByKey.budgetCycles],
    },
    {
        title: "Budget Preparation",
        modules: [
            moduleLinksByKey.tierOne,
            moduleLinksByKey.proposals,
        ],
    },
]

function formatDate(value: Date | string) {
    return new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value))
}

export default async function HomePage() {
    const session = await sessionWithEntity()

    if (!session) {
        return redirect("/login")
    }
    if (isUnverifiedUser(session.user)) {
        return redirect("/pending-approval")
    }
    if (!isActiveUser(session.user)) {
        return redirect("/login")
    }
    if (session.user.role !== "dbm") {
        return redirect("/home")
    }

    const isApprover = isDbmUser(session.user)
    const [activeCycle, pendingFormsResult] = await Promise.all([
        BudgetSettingsRepository.getActiveBudgetCycle(),
        FormRepository.getAllForms({
            auth_status: "pending_dbm",
            limit: APPROVAL_PREVIEW_LIMIT,
            offset: 0,
        }),
    ])
    const pendingForms = pendingFormsResult.forms
    const pendingCount = pendingFormsResult.totalCount
    const visibleModuleGroups = moduleGroups
        .map((group) => ({
            ...group,
            modules: group.modules.filter((module) => (
                isApprover || !(group.approverOnlyModules ?? []).some((approverOnly) => approverOnly.href === module.href)
            )),
        }))
        .filter((group) => group.modules.length > 0)

    return (
        <main className="min-h-screen bg-background">
            <div className="mx-auto flex w-full flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <DashboardHeader
                    eyebrow="Department of Budget and Management"
                    title="DBM Workspace"
                    description="Monitor the active budget phase, jump to DBM modules, and review the latest forms waiting for action."
                    actions={[{ href: "/home", label: "Go to Home" }]}
                />

                <section aria-labelledby="dbm-overview-heading" className="grid gap-4 lg:grid-cols-[1fr_3fr]">
                    <h2 id="dbm-overview-heading" className="sr-only">
                        DBM overview
                    </h2>
                    <article className="flex h-full flex-col rounded-3xl border border-border bg-background p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                    Current Phase
                                </p>
                                <h3 className="mt-3 text-2xl font-black text-secondary-foreground">
                                    {activeCycle ? BUDGET_PHASE_LABELS[activeCycle.current_phase] : "No Active Cycle"}
                                </h3>
                            </div>
                            <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                {activeCycle?.prep_status ?? "closed"}
                            </span>
                        </div>
                        <dl className="my-4 grid gap-2 text-sm">
                            <div className="rounded-2xl bg-muted p-4">
                                <dt className="font-semibold text-muted-foreground">Fiscal Year</dt>
                                <dd className="mt-1 text-xl font-black text-secondary-foreground">
                                    {activeCycle?.fiscal_year ? `FY ${activeCycle.fiscal_year}` : "Not started"}
                                </dd>
                            </div>
                            <div className="rounded-2xl bg-muted p-4">
                                <dt className="font-semibold text-muted-foreground">Opened</dt>
                                <dd className="mt-1 font-bold text-secondary-foreground">
                                    {activeCycle?.prep_opened_at ? formatDate(activeCycle.prep_opened_at) : "No active preparation window"}
                                </dd>
                            </div>
                        </dl>
                        {isApprover && (
                            <Link
                                href="/dbm/settings/cycles"
                                className="mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-secondary-foreground px-4 py-2 text-sm font-bold text-accent transition hover:bg-secondary-foreground/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                Manage Budget Cycle
                            </Link>
                        )}
                    </article>

                    <article className="rounded-3xl border border-border bg-background shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                    Needs Approval
                                </p>
                                <h3 className="mt-1 text-2xl font-black text-secondary-foreground">
                                    Latest Pending Forms
                                </h3>
                            </div>
                            <Link
                                href="/dbm/forms?status=pending_dbm"
                                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-bold text-secondary-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                aria-label={`View all ${pendingCount} forms pending DBM approval`}
                            >
                                View all ({pendingCount})
                            </Link>
                        </div>
                        <div className="divide-y divide-border">
                            {pendingForms.length > 0 ? (
                                pendingForms.map((form) => (
                                    <Link
                                        key={form.id}
                                        href={`/dbm/forms/${form.id}`}
                                        className="block p-5 transition hover:bg-primary-foreground/20 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p className="font-black text-secondary-foreground">
                                                    {FORM_NAMES[form.type ?? ""] ?? form.type ?? "Budget Form"}
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {form.entity_name ?? "Unknown entity"}
                                                    {form.department_name ? ` • ${form.department_name}` : ""}
                                                </p>
                                                <p className="mt-1 text-xs font-medium text-muted-foreground">
                                                    FY {form.fiscal_year} • Version {form.version} • Updated {formatDate(form.updated_at)}
                                                </p>
                                            </div>
                                            <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                                                {STATUS_LABELS[form.auth_status ?? ""] ?? "Pending"}
                                            </span>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="p-8 text-center">
                                    <p className="text-sm font-semibold text-secondary-foreground">
                                        No forms are pending DBM approval.
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        The queue is clear for now.
                                    </p>
                                </div>
                            )}
                        </div>
                    </article>
                </section>

                <section aria-labelledby="dbm-modules-heading" className="space-y-4 rounded-3xl border border-border p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                Modules
                            </p>
                            <h2 id="dbm-modules-heading" className="text-2xl font-black text-secondary-foreground">
                                Go to a DBM Module
                            </h2>
                        </div>
                    </div>
                    <div className="space-y-6">
                        {visibleModuleGroups.map((group) => (
                            <section key={group.title} className="space-y-3">
                                <h3 className="text-lg font-black text-secondary-foreground">{group.title}</h3>
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {group.modules.map((module) => (
                                        <Link
                                            key={module.href}
                                            href={module.href}
                                            className="group rounded-2xl border border-border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-secondary-foreground/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        >
                                            <span className="text-lg font-black text-secondary-foreground group-hover:underline">
                                                {module.title}
                                            </span>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                {module.description}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    )
}
