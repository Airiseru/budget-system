'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CarouselItem = {
    id: string
    title: string
    description: string
}

type Props = {
    items: CarouselItem[]
    className?: string
    autoPlayIntervalMs?: number
    renderItem?: (item: CarouselItem, index: number) => ReactNode
}

export default function Carousel({
    items,
    className,
    autoPlayIntervalMs = 6000,
    renderItem,
}: Props) {
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        if (items.length <= 1 || autoPlayIntervalMs <= 0) return

        const interval = window.setInterval(() => {
            setCurrentIndex((current) => (current + 1) % items.length)
        }, autoPlayIntervalMs)

        return () => window.clearInterval(interval)
    }, [autoPlayIntervalMs, items.length])

    if (items.length === 0) return null

    const currentItem = items[currentIndex]
    const goPrevious = () => setCurrentIndex((current) => (current === 0 ? items.length - 1 : current - 1))
    const goNext = () => setCurrentIndex((current) => (current + 1) % items.length)

    return (
        <section className={cn('space-y-4', className)} aria-roledescription="carousel">
            <div
                key={currentItem.id}
                aria-live="polite"
                className="animate-in fade-in-0 slide-in-from-right-3 duration-700 ease-out"
            >
                {renderItem ? renderItem(currentItem, currentIndex) : (
                    <article className="rounded-2xl border border-border bg-background p-5">
                        <h3 className="text-lg font-bold">{currentItem.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{currentItem.description}</p>
                    </article>
                )}
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon-sm" onClick={goPrevious} aria-label="Previous slide">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="icon-sm" onClick={goNext} aria-label="Next slide">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2" aria-label="Carousel slides">
                    {items.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setCurrentIndex(index)}
                            aria-label={`Go to slide ${index + 1}`}
                            aria-current={index === currentIndex}
                            className={cn(
                                'h-2.5 rounded-full transition-all',
                                index === currentIndex
                                    ? 'w-8 bg-current'
                                    : 'w-2.5 bg-current/35 hover:bg-current/60'
                            )}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
