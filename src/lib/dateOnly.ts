export function parseDateOnlyToUtcNoon(value: string): Date {
    const [year, month, day] = value.split('-').map(Number)

    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day)
    ) {
        throw new Error(`Invalid date-only value: ${value}`)
    }

    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
}

export function formatDateOnlyForInput(dateLike: Date | string): string {
    if (typeof dateLike === 'string') {
        const directDateMatch = dateLike.match(/^(\d{4}-\d{2}-\d{2})/)
        if (directDateMatch) {
            return directDateMatch[1]
        }
    }

    const date = new Date(dateLike)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}
