import { Diff } from '../types/audit'

const IGNORED_FIELDS = ['created_at', 'updated_at']

export function computeDiff(
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>
): Diff {
    const diff: Diff = {}
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])

    for (const key of allKeys) {
        if (IGNORED_FIELDS.includes(key)) continue
        const oldVal = oldData[key]
        const newVal = newData[key]
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            diff[key] = { from: oldVal, to: newVal }
        }
    }

    return diff
}

export function isDiffEmpty(diff: Diff): boolean {
    return Object.keys(diff).length === 0
}

export function replayDiffs(
    snapshot: Record<string, unknown>,
    diffs: Diff[]
): Record<string, unknown> {
    // Function to apply changes to the snapshot
    return diffs.reduce((record, diff) => {
        const updated = { ...record }
        for (const [key, { to }] of Object.entries(diff)) {
            updated[key] = to
        }
        return updated
    }, snapshot)
}