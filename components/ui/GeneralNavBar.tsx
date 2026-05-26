'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FolderKanban, Home, Menu, Settings, X } from 'lucide-react'
import { LogoutButton } from '@/components/ui/LogoutButton'

const hiddenPaths = new Set([
    '/',
    '/home',
    '/admin',
    '/dbm',
    '/login',
    '/signup',
    '/pending-approval',
])

const navLinks = [
    { href: '/home', label: 'Home', icon: Home },
    { href: '/paps', label: 'Projects', icon: FolderKanban },
    { href: '/home/settings', label: 'Settings', icon: Settings },
]

export default function GeneralNavBar() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0 })
    }, [pathname])

    if (hiddenPaths.has(pathname) || pathname.startsWith('/api')) {
        return null
    }

    return (
        <nav className="sticky top-0 z-40 border-b border-border bg-background/95 p-4 shadow-sm backdrop-blur sm:px-6 lg:px-8" aria-label="General navigation">
            <div className="mx-auto flex w-full flex-col gap-3">
                <div className="flex items-center justify-between gap-4 md:hidden">
                    <span className="text-sm font-black uppercase tracking-[0.16em] text-secondary-foreground">
                        Menu
                    </span>
                    <button
                        type="button"
                        onClick={() => setOpen((current) => !current)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-secondary-foreground shadow-sm transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        aria-expanded={open}
                        aria-controls="general-navbar-links"
                    >
                        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                        {open ? 'Close' : 'Open'}
                    </button>
                </div>

                <div
                    id="general-navbar-links"
                    className={`${open ? 'flex' : 'hidden'} flex-col gap-3 md:flex md:flex-row md:items-center md:justify-between md:gap-4`}
                >
                    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-4">
                    {navLinks.map((item) => {
                        const Icon = item.icon
                        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className={`inline-flex min-h-10 w-full items-center gap-2 rounded-xl border-b px-3 py-2 text-sm font-bold transition hover:-translate-y-0.5 hover:border-secondary-foreground/40 hover:drop-shadow-md hover:drop-shadow-primary-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:w-auto ${
                                    active
                                        ? 'border-secondary-foreground bg-secondary-foreground text-accent'
                                        : 'border-border bg-background text-secondary-foreground hover:bg-muted'
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                    </div>
                    <LogoutButton className="min-h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-secondary-foreground shadow-sm transition hover:bg-secondary-foreground hover:text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 md:w-auto" />
                </div>
            </div>
        </nav>
    )
}
