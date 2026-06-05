type LoadingOverlayProps = {
    show: boolean
    label?: string
    fullScreen?: boolean
}

export default function LoadingOverlay({
    show,
    label = "Working...",
    fullScreen = true,
}: LoadingOverlayProps) {
    if (!show) return null

    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className={`${fullScreen ? "fixed inset-0" : "absolute inset-0"} z-50 flex items-center justify-center bg-background/75 p-6 backdrop-blur-sm`}
        >
            <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-border bg-background px-5 py-4 text-secondary-foreground shadow-lg">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-secondary-foreground" />
                <span className="text-sm font-bold">{label}</span>
            </div>
        </div>
    )
}
