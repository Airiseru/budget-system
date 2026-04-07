import { sessionDetails } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import SettingsNav from '@/components/ui/SettingsNav'
import { requireMinAccessLevel } from '@/src/actions/auth'

export default async function SettingsPage() {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    const canAccessKeys = await requireMinAccessLevel('encode', false)

    return (
        <main className="m-6 max-w-2xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/home" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Manage your account and security preferences
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <SettingsNav canAccessKeys={canAccessKeys as boolean} />
        </main>
    )
}