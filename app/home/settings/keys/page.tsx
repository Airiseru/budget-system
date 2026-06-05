import { requireMinAccessLevel } from '@/src/actions/auth'
import { getUserKeys, hasSigningPin } from '@/src/actions/keys'
import { DeviceKeyBanner } from '@/components/ui/digital-signatures/DeviceKeyBanner'
import { DeviceKeysSettings } from '@/components/ui/digital-signatures/DeviceKeysSettings'
import { SetPinForm } from '@/components/ui/digital-signatures/setPin'
import BackButton from '@/components/ui/BackButton'

export default async function KeysSettingsPage() {
    const session = await requireMinAccessLevel('encode', true) as { user: { id: string, entity_id: string } }

    const [keys, hasPinAlready] = await Promise.all([
        getUserKeys(),
        hasSigningPin(),
    ])

    return (
        <main className="m-6 max-w-2xl md:mx-auto md:my-12 space-y-8">
            <div className="flex items-center justify-between">
                <BackButton url="/home/settings" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Security Settings</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Manage your signing keys and PIN
                    </p>
                </div>
                <div className="w-[73px]" />
            </div>

            <DeviceKeyBanner userId={session.user.id} />

            <hr className="border-border" />

            <SetPinForm hasPin={hasPinAlready} />

            <hr className="border-border" />

            <DeviceKeysSettings keys={keys} entityId={session.user.entity_id} userId={session.user.id} />
        </main>
    )
}