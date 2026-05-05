interface BudgetPrepClosedBannerProps {
    message?: string;
}

export default function BudgetPrepClosedBanner({
    message = "The budget preparation phase is still closed. Please wait for further announcements from DBM.",
}: BudgetPrepClosedBannerProps) {
    return (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {message}
        </div>
    );
}
