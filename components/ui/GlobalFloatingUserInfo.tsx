'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import FloatingUserInfo from '@/components/ui/FloatingUserInfo'

type UserProfile = {
    name: string
    position: string
    entity: string
}

type ProfileResponse = {
    user: UserProfile | null
}

export default function GlobalFloatingUserInfo() {
    const pathname = usePathname()
    const [profile, setProfile] = useState<UserProfile | null>(null)

    useEffect(() => {
        const controller = new AbortController()

        async function loadProfile() {
            try {
                const response = await fetch('/api/session/profile', {
                    cache: 'no-store',
                    credentials: 'same-origin',
                    signal: controller.signal,
                })

                if (!response.ok) {
                    setProfile(null)
                    return
                }

                const data = await response.json() as ProfileResponse
                setProfile(data.user)
            } catch (error) {
                if (controller.signal.aborted) return
                console.error('Failed to load user profile:', error)
                setProfile(null)
            }
        }

        loadProfile()

        return () => controller.abort()
    }, [pathname])

    if (!profile) return null

    return (
        <FloatingUserInfo
            name={profile.name}
            position={profile.position}
            entity={profile.entity}
        />
    )
}
