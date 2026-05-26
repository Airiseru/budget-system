'use client'

import { useSyncExternalStore } from 'react'
import FloatingStatus, { type FloatingStatusMessage } from '@/components/ui/FloatingStatus'

const WELCOME_STATUS_KEY = 'budget-system:welcome-status'
const WELCOME_STATUS_EVENT = 'budget-system:welcome-status-change'

function emitWelcomeStatusChange() {
    window.dispatchEvent(new Event(WELCOME_STATUS_EVENT))
}

export function queueWelcomeStatus(name: string) {
    if (typeof window === 'undefined') return

    window.sessionStorage.setItem(WELCOME_STATUS_KEY, `Welcome ${name}`)
    emitWelcomeStatusChange()
}

function subscribe(onStoreChange: () => void) {
    window.addEventListener(WELCOME_STATUS_EVENT, onStoreChange)
    window.addEventListener('storage', onStoreChange)

    return () => {
        window.removeEventListener(WELCOME_STATUS_EVENT, onStoreChange)
        window.removeEventListener('storage', onStoreChange)
    }
}

function getSnapshot() {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(WELCOME_STATUS_KEY)
}

function getServerSnapshot() {
    return null
}

export default function GlobalWelcomeStatus() {
    const message = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
    const status: FloatingStatusMessage = message
        ? { type: 'success', message }
        : null

    const clearStatus = () => {
        window.sessionStorage.removeItem(WELCOME_STATUS_KEY)
        emitWelcomeStatusChange()
    }

    return (
        <FloatingStatus
            status={status}
            onClear={clearStatus}
        />
    )
}
