import { requireAdmin } from "@/src/actions/admin"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    await requireAdmin()

    return <>{children}</>
}