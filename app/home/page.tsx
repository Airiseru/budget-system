import Link from "next/link"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import DashboardHeader from "@/components/ui/DashboardHeader"
import FloatingUserInfo from "@/components/ui/FloatingUserInfo"
import {
    createEntityRepository,
    createFormRepository,
    createProposalRepository,
} from "@/src/db/factory"
import { sessionWithEntity } from "@/src/actions/auth"
import { FORM_NAMES, STATUS_LABELS } from "@/src/lib/constants"
import { getCurrentSignatoryRole, getWorkflow, canSign } from "@/src/lib/workflows"
import { isActiveUser, isUnverifiedUser } from "@/src/lib/user-status"

const ProposalRepository = createProposalRepository(process.env.DATABASE_TYPE || "postgres")
const FormRepository = createFormRepository(process.env.DATABASE_TYPE || "postgres")
const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || "postgres")
const PREVIEW_LIMIT = 8

const baseNavigation = [
    { href: "/paps", label: "PAPs" },
    { href: "/forms/proposals", label: "BP 202/203 Proposals" },
    { href: "/forms/staff", label: "BP 204 Staffing" },
    { href: "/forms/retirees", label: "BP 205 Retirees" },
    { href: "/home/settings", label: "Settings" },
]

function formatDate(value: Date | string | null | undefined) {
    if (!value) return "No date"
    return new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(value))
}

function getProjectTypeLabel(type: string | null | undefined) {
    if (type === "202") return "Local"
    if (type === "203") return "Foreign"
    return "Project"
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

    const entityId = session.user.entity_id ?? ""
    const isDBM = session.user.role === "dbm"
    const accessibleEntityIds = !isDBM && entityId
        ? await EntityRepository.getAccessibleEntityIds(entityId)
        : []
    const navigation = isDBM
        ? [{ href: "/dbm", label: "DBM Workspace" }, ...baseNavigation]
        : baseNavigation
    const visibleNavigation = session.user.is_admin
        ? [{ href: "/admin", label: "Admin" }, ...navigation]
        : navigation
    const userEntityLabel = session.user_entity.entity_full_name
        ?? session.user_entity.entity_name
        ?? "No entity assigned"

    const [projectRows, formRowsResult] = await Promise.all([
        entityId
            ? ProposalRepository.getAllProposalSummaries(
                session.user_entity.entity_type ?? "",
                isDBM ? "national" : session.user.role ?? "",
                entityId,
            )
            : Promise.resolve([]),
        FormRepository.getAllForms({
            limit: 100,
            offset: 0,
        }),
    ])

    const latestProjects = projectRows
        .sort((a, b) => {
            const yearDiff = b.proposal_year - a.proposal_year
            if (yearDiff !== 0) return yearDiff
            return Number(a.priority_rank ?? 0) - Number(b.priority_rank ?? 0)
        })
        .slice(0, PREVIEW_LIMIT)

    const formsToApprove = formRowsResult.forms
        .filter((form) => {
            if (!form.auth_status || !form.type) return false
            if (!isDBM && !accessibleEntityIds.includes(form.entity_id)) return false

            try {
                const workflow = getWorkflow(form.type)
                const signatoryRole = getCurrentSignatoryRole(form.auth_status, workflow)
                if (!signatoryRole) return false

                return canSign(
                    form.auth_status,
                    session.user.access_level ?? "",
                    session.user.workflow_role ?? "",
                    signatoryRole,
                    workflow,
                )
            } catch {
                return false
            }
        })
        .slice(0, PREVIEW_LIMIT)

    return (
        <main className="min-h-screen bg-background">
            <div className="mx-auto flex w-full flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <DashboardHeader
                    eyebrow="Budget System"
                    title="Home"
                    description="Quick access to your modules, recent projects, and forms waiting for your approval."
                    navigation={visibleNavigation}
                    navLabel="Primary modules"
                    showLogout
                />

                <section className="space-y-6">
                    <article className="rounded-3xl border border-border bg-background shadow-sm">
                        <div className="border-b border-border p-5">
                            <h2 className="text-xl font-black text-secondary-foreground">Latest Projects</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Most recent project proposals visible to your entity.</p>
                        </div>
                        <div className="divide-y divide-border">
                            {latestProjects.length > 0 ? latestProjects.map((project) => (
                                <Link
                                    key={project.id}
                                    href={`/forms/proposals/${project.id}`}
                                    className="block p-5 transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-black text-secondary-foreground">{project.title}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {project.entity_name ?? "Unknown entity"} • FY {project.proposal_year}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {getProjectTypeLabel(project.type)} • Rank #{project.priority_rank}
                                            </p>
                                        </div>
                                        <Badge variant="outline">
                                            {STATUS_LABELS[project.auth_status ?? "draft"] ?? project.auth_status ?? "Draft"}
                                        </Badge>
                                    </div>
                                </Link>
                            )) : (
                                <div className="p-8 text-center text-sm text-muted-foreground">
                                    No project proposals found.
                                </div>
                            )}
                        </div>
                    </article>

                    <article className="rounded-3xl border border-border bg-background shadow-sm">
                        <div className="border-b border-border p-5">
                            <h2 className="text-xl font-black text-secondary-foreground">Forms To Approve</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Forms currently assigned to your workflow role.</p>
                        </div>
                        <div className="divide-y divide-border">
                            {formsToApprove.length > 0 ? formsToApprove.map((form) => (
                                <Link
                                    key={form.id}
                                    href={isDBM ? `/dbm/forms/${form.id}` : `${form.type?.includes("proposal") ? "/forms/proposals" : form.type === "bp_staffing" ? "/forms/staff" : "/forms/retirees"}/${form.id}`}
                                    className="block p-5 transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-black text-secondary-foreground">
                                                {FORM_NAMES[form.type ?? ""] ?? form.type ?? "Budget Form"}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {form.entity_name ?? "Unknown entity"} • FY {form.fiscal_year}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Updated {formatDate(form.updated_at)}
                                            </p>
                                        </div>
                                        <Badge variant="secondary">
                                            {STATUS_LABELS[form.auth_status ?? ""] ?? form.auth_status}
                                        </Badge>
                                    </div>
                                </Link>
                            )) : (
                                <div className="p-8 text-center text-sm text-muted-foreground">
                                    No forms need your approval right now.
                                </div>
                            )}
                        </div>
                    </article>
                </section>
            </div>
            <FloatingUserInfo
                name={session.user.name}
                position={session.user.position || "No position set"}
                entity={userEntityLabel}
            />
        </main>
    )
}
