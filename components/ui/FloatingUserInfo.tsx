'use client'

import { User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type FloatingUserInfoProps = {
    name: string
    position: string
    entity: string
}

export default function FloatingUserInfo({ name, position, entity }: FloatingUserInfoProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return

        const handlePointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [open])

    return (
        <div data-global-chrome data-floating-user-info ref={containerRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
            {open && (
                <section
                    className="mb-3 w-[min(calc(100vw-3rem),22rem)] rounded-3xl border border-border bg-background p-5 drop-shadow-primary-foreground/70 drop-shadow-md"
                    aria-label="User information"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                Signed In As
                            </p>
                            <h2 className="mt-2 text-lg font-black text-secondary-foreground">{name}</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="rounded-full border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            aria-label="Close user information"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <dl className="mt-4 space-y-3 text-sm">
                        <div className="rounded-2xl bg-muted p-3">
                            <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Position</dt>
                            <dd className="mt-1 font-bold text-secondary-foreground">{position}</dd>
                        </div>
                        <div className="rounded-2xl bg-muted p-3">
                            <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Entity</dt>
                            <dd className="mt-1 font-bold text-secondary-foreground">{entity}</dd>
                        </div>
                    </dl>
                </section>
            )}

            <button
                type="button"
                onClick={() => setOpen((current) => !current)}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-secondary-foreground text-accent shadow-lg transition hover:scale-105 hover:bg-secondary-foreground/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-expanded={open}
                aria-label={open ? 'Hide user information' : 'Show user information'}
            >
                <User className="h-6 w-6" />
            </button>
        </div>
    )
}
