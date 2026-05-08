"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

type Props<T> = {
    title: string
    description?: string
    collapsedLabel?: string
    items: T[]
    emptyMessage?: string
    maxHeightClassName?: string
    renderItem: (item: T, index: number) => ReactNode
}

export default function CollapsibleRemarksSection<T>({
    title,
    description,
    collapsedLabel,
    items,
    emptyMessage = "No remarks logged yet.",
    maxHeightClassName,
    renderItem,
}: Props<T>) {
    const [open, setOpen] = useState(false)

    return (
        <section className="rounded-xl border border-border bg-background overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className={`flex w-full items-center justify-between px-5 py-4 text-left ${open ? "border-b border-border" : ""}`}
            >
                <div>
                    <h3 className="text-base font-semibold text-secondary-foreground">
                        {title}
                    </h3>
                    {description && (
                        <p className="text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {open && (
                <div className={maxHeightClassName}>
                    {collapsedLabel && (
                        <div className="border-b border-border bg-background px-4 py-3 text-sm font-semibold text-secondary-foreground">
                            {collapsedLabel} ({items.length})
                        </div>
                    )}
                    {items.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-muted-foreground">
                            {emptyMessage}
                        </p>
                    ) : (
                        <div>{items.map((item, index) => renderItem(item, index))}</div>
                    )}
                </div>
            )}
        </section>
    )
}
