import Link from 'next/link'

function generatePageNumbers(currentPage: number, totalPages: number) {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
    if (currentPage <= 3) return [1, 2, 3, '...', totalPages]
    if (currentPage >= totalPages - 2) return [1, '...', totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', currentPage, '...', totalPages]
}

type Props = {
    page: number
    totalPages: number
    getPageHref: (page: number) => string
    className?: string
}

export default function PaginationControls({
    page,
    totalPages,
    getPageHref,
    className = '',
}: Props) {
    const safeTotalPages = totalPages !== 0 ? totalPages : 1

    return (
        <div className={`flex items-center justify-between border-t border-border/30 bg-muted p-4 ${className}`}>
            <p className="text-sm text-muted-foreground">
                Showing page <span className="font-bold">{page}</span> of <span className="font-bold">{safeTotalPages}</span>
            </p>
            <div className="flex items-center gap-1">
                <Link
                    href={page > 1 ? getPageHref(page - 1) : '#'}
                    className={`rounded px-2.5 py-1.5 text-sm font-bold transition-colors ${page > 1 ? 'bg-accent text-secondary-foreground hover:bg-secondary' : 'pointer-events-none bg-accent/50 text-muted-foreground/40'}`}
                    aria-disabled={page <= 1}
                >
                    &lt;
                </Link>
                {generatePageNumbers(page, safeTotalPages).map((current, index) =>
                    current === '...' ? (
                        <span key={`ellipsis-${index}`} className="px-2 py-1.5 text-sm font-bold text-muted-foreground">
                            ...
                        </span>
                    ) : (
                        <Link
                            key={`page-${current}`}
                            href={getPageHref(current as number)}
                            className={`rounded border-b px-3 py-1.5 text-sm font-bold transition-colors ${
                                page === current
                                    ? 'border-secondary-foreground bg-secondary-foreground text-accent'
                                    : 'border-border/50 bg-accent text-secondary-foreground hover:bg-secondary'
                            }`}
                        >
                            {current}
                        </Link>
                    )
                )}
                <Link
                    href={page < safeTotalPages ? getPageHref(page + 1) : '#'}
                    className={`rounded px-2.5 py-1.5 text-sm font-bold transition-colors ${page < safeTotalPages ? 'bg-accent text-secondary-foreground hover:bg-secondary' : 'pointer-events-none bg-accent/50 text-muted-foreground/40'}`}
                    aria-disabled={page >= safeTotalPages}
                >
                    &gt;
                </Link>
            </div>
        </div>
    )
}
