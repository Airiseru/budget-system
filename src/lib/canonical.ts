export function canonicalStringify(value: unknown): string {
    return JSON.stringify(sortKeysRecursively(value))
}

function sortKeysRecursively(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(sortKeysRecursively)

    return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce((sorted, key) => {
            sorted[key] = sortKeysRecursively(
                (value as Record<string, unknown>)[key]
            )
            return sorted
        }, {} as Record<string, unknown>)
}