import { getPendingUsers } from "@/src/actions/admin"
import { PendingUsersTable } from "./PendingUsersTable"
import { PendingAlert } from "./PendingAlert"
import BackButton from "@/components/ui/BackButton"

export default async function AdminPendingPage() {
    const pendingUsers = await getPendingUsers()
    return (
        <main className="p-8 max-w-6xl mx-auto space-y-6">
            <BackButton />
            <PendingAlert />
            <PendingUsersTable users={pendingUsers} />
        </main>
    )
}