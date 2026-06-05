import { requireDbm } from "@/src/actions/admin"

export default async function DbmLayout({ children }: { children: React.ReactNode }) {
    await requireDbm()

    return <>{children}</>
}