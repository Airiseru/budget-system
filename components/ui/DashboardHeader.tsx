'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { LogoutButton } from '@/components/ui/LogoutButton'

type DashboardHeaderLink = {
    href: string
    label?: string
    title?: string
    description?: string
}

type DashboardHeaderChip = {
    label: string
    emphasis?: boolean
}

type DashboardHeaderAction = {
    href: string
    label: string
}

type DashboardHeaderProps = {
    eyebrow: string
    title: string
    description: string
    navigation?: DashboardHeaderLink[]
    navLabel?: string
    chips?: DashboardHeaderChip[]
    actions?: DashboardHeaderAction[]
    showLogout?: boolean
    detailedNavigation?: boolean
    defaultOpen?: boolean
}

export default function DashboardHeader({
    eyebrow,
    title,
    description,
    navigation = [],
    navLabel,
    chips = [],
    actions = [],
    showLogout = false,
    detailedNavigation = false,
    defaultOpen = true,
}: DashboardHeaderProps) {
    const [open, setOpen] = useState(defaultOpen)
    const hasNavigation = navigation.length > 0 && !!navLabel

    return (
        <header className="w-full rounded-3xl border border-border bg-accent p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        {eyebrow}
                    </p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-secondary-foreground sm:text-4xl">
                        {title}
                    </h1>
                </div>
                <button
                    type="button"
                    onClick={() => setOpen((current) => !current)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-secondary-foreground shadow-sm transition hover:bg-secondary-foreground hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-expanded={open}
                    aria-controls="dashboard-header-content"
                >
                    {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    <span className="hidden sm:inline">{open ? 'Collapse' : 'Menu'}</span>
                </button>
            </div>

            {open && (
                <div id="dashboard-header-content" className="mt-6 space-y-6 border-t border-border pt-5">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-base leading-7 text-muted-foreground">
                                {description}
                            </p>
                            {chips.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                                    {chips.map((chip) => (
                                        <span
                                            key={chip.label}
                                            className={`rounded-md border border-border bg-background px-3 py-2 ${chip.emphasis ? 'font-bold text-secondary-foreground' : 'text-muted-foreground'}`}
                                        >
                                            {chip.label}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        {(actions.length > 0 || showLogout) && (
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                {actions.map((action) => (
                                    <Link
                                        key={action.href}
                                        href={action.href}
                                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-bold text-secondary-foreground shadow-sm transition hover:bg-secondary-foreground hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        {action.label}
                                    </Link>
                                ))}
                                {showLogout && <LogoutButton />}
                            </div>
                        )}
                    </div>

                    {hasNavigation && (
                        <nav
                            aria-label={navLabel}
                            className={`grid w-full gap-2 ${detailedNavigation ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}
                        >
                            {navigation.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`group hover:text-white ${detailedNavigation ? 'min-h-28 flex-col items-start justify-center text-left' : 'min-h-11 items-center justify-center text-center'} flex w-full rounded-xl border border-border bg-background px-4 py-2 text-md font-bold text-secondary-foreground transition hover:bg-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2`}
                                >
                                    <span>{item.title ?? item.label}</span>
                                    {detailedNavigation && item.description && (
                                        <span className="mt-1 text-sm font-medium leading-5 text-muted-foreground group-hover:text-gray-300">
                                            {item.description}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </nav>
                    )}
                </div>
            )}
        </header>
    )
}
