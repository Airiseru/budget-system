import { sessionWithEntity } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import { ROLE_LABELS, ACCESS_LEVEL_LABELS } from '@/src/lib/constants'

export default async function UserSettingsPage() {
    const session = await sessionWithEntity()
    if (!session) redirect('/login')

    return (
        <main className="m-6 max-w-2xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/home/settings" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">User Settings</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Update your account details
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <div className="border border-border rounded-lg p-6 space-y-4">
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{session.user.name}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{session.user.email}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Designation</p>
                    <p className="font-medium">{session.user_entity.entity_full_name}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-medium capitalize">{ROLE_LABELS[session.user.role]}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Access Level</p>
                    <p className="font-medium capitalize">{ACCESS_LEVEL_LABELS[session.user.access_level]}</p>
                </div>
            </div>

            {/* placeholder for edit form — add UserSettingsForm component here later */}
        </main>
    )
}