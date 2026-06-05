import { createHash } from "crypto"
import { AuditLog, AuditEventType, AuditLogEntryPayload } from "../types/audit"
import { canonicalStringify } from "./canonical"
import { MerkleTree } from "merkletreejs"

export type ChainFailureReason =
    | 'broken_prev_hash'
    | 'hash_mismatch'

export type ChainFailureReport = {
    reason: ChainFailureReason
    brokenLogId: string
    expectedPrevHash: string | null
    actualPrevHash: string | null
    expectedHash?: string
    actualHash?: string
    brokenLog: Pick<AuditLog, 'id' | 'changed_at' | 'prev_hash' | 'hash' | 'table_name' | 'record_id' | 'event_type' | 'payload'>
    siblingLogsWithSamePrevHash: Array<Pick<AuditLog, 'id' | 'changed_at' | 'prev_hash' | 'hash' | 'table_name' | 'record_id' | 'event_type' | 'payload'>>
    nearbyLogs: Array<Pick<AuditLog, 'id' | 'changed_at' | 'prev_hash' | 'hash' | 'table_name' | 'record_id' | 'event_type' | 'payload'>>
    timestampCollisions: Array<{
        changedAt: string
        logIds: string[]
    }>
}

export type ChainVerificationResult = {
    isValid: boolean
    brokenAt: string | null
    report?: ChainFailureReport
}

export function sha256(data: string): string {
    return createHash('sha256').update(data).digest('hex')
}

export function computeAuditEntryHash(entry: AuditLogEntryPayload): string {
    // Replace null values with strings
    entry.table_name = entry.table_name ?? "NULL"
    entry.record_id = entry.record_id ?? "NULL"
    entry.payload = entry.payload ?? "NULL"
    entry.prev_hash = entry.prev_hash ?? "NULL"
    entry.public_key_snapshot = entry.public_key_snapshot ?? "NULL"
    entry.signature = entry.signature ?? "NULL"

    // Stringify stored keys
    const stringEntry = canonicalStringify(entry)

    // Create hash
    return sha256(stringEntry)
}

export function buildSignaturePayload(log: {
    entity_id: string
    user_id: string
    event_type: AuditEventType
    table_name: string | null
    record_id: string | null
    payload: Record<string, unknown> | string | null
    changed_at: Date
}): string {
    return canonicalStringify({
        entity_id: log.entity_id,
        user_id: log.user_id,
        event_type: log.event_type,
        table_name: log.table_name ?? null,
        record_id: log.record_id ?? null,
        changed_at: log.changed_at,
        payload: log.payload ?? null,
    })
}

function compareAuditLogs(a: AuditLog, b: AuditLog) {
    const timeDiff = new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    if (timeDiff !== 0) return timeDiff
    return a.id.localeCompare(b.id)
}

function toReportLog(log: AuditLog) {
    return {
        id: log.id,
        changed_at: log.changed_at,
        prev_hash: log.prev_hash,
        hash: log.hash,
        table_name: log.table_name,
        record_id: log.record_id,
        event_type: log.event_type,
        payload: log.payload,
    }
}

function getTimestampCollisions(logs: AuditLog[]) {
    const logsByTimestamp = new Map<string, string[]>()

    for (const log of logs) {
        const timestamp = new Date(log.changed_at).toISOString()
        logsByTimestamp.set(timestamp, [...(logsByTimestamp.get(timestamp) ?? []), log.id])
    }

    return [...logsByTimestamp.entries()]
        .filter(([, logIds]) => logIds.length > 1)
        .map(([changedAt, logIds]) => ({ changedAt, logIds }))
}

function createChainFailureReport(params: {
    logs: AuditLog[]
    sortedLogs: AuditLog[]
    brokenLog: AuditLog
    expectedPrevHash: string | null
    expectedHash?: string
    reason: ChainFailureReason
}) {
    const brokenIndex = params.sortedLogs.findIndex((log) => log.id === params.brokenLog.id)
    const nearbyLogs = params.sortedLogs
        .slice(Math.max(0, brokenIndex - 3), brokenIndex + 4)
        .map(toReportLog)
    const siblingLogsWithSamePrevHash = params.logs
        .filter((log) =>
            log.id !== params.brokenLog.id &&
            log.prev_hash === params.brokenLog.prev_hash
        )
        .sort(compareAuditLogs)
        .map(toReportLog)

    return {
        reason: params.reason,
        brokenLogId: params.brokenLog.id,
        expectedPrevHash: params.expectedPrevHash,
        actualPrevHash: params.brokenLog.prev_hash,
        expectedHash: params.expectedHash,
        actualHash: params.brokenLog.hash,
        brokenLog: toReportLog(params.brokenLog),
        siblingLogsWithSamePrevHash,
        nearbyLogs,
        timestampCollisions: getTimestampCollisions(params.logs),
    }
}

export function verifyChain(logs: AuditLog[]): ChainVerificationResult {
    return verifyChainSegment(logs, null)
}

export function verifyChainSegment(
    logs: AuditLog[],
    expectedStartingPrevHash: string | null
): ChainVerificationResult {
    if (logs.length === 0) return { isValid: true, brokenAt: null }

    const sorted = [...logs].sort(compareAuditLogs)

    let expectedPrevHash: string | null = expectedStartingPrevHash

    for (const log of sorted) {
        if (expectedPrevHash !== null && log.prev_hash !== expectedPrevHash) {
            console.error(`[AUDIT] Broken Chain Link: Log ${log.id} expected prev_hash ${expectedPrevHash} but got ${log.prev_hash}`)
            return {
                isValid: false,
                brokenAt: log.id,
                report: createChainFailureReport({
                    logs,
                    sortedLogs: sorted,
                    brokenLog: log,
                    expectedPrevHash,
                    reason: 'broken_prev_hash',
                }),
            }
        }

        const expected = computeAuditEntryHash({
            entity_id: log.entity_id,
            user_id: log.user_id,
            event_type: log.event_type as AuditLogEntryPayload['event_type'],
            table_name: log.table_name ?? "NULL",
            record_id: log.record_id ?? "NULL",
            payload: log.payload ?? "NULL",
            changed_at: (new Date(log.changed_at)).toISOString(),
            prev_hash: log.prev_hash ?? "NULL",
            public_key_snapshot: log.public_key_snapshot ?? "NULL",
            signature: log.signature ?? "NULL"
        })

        if (expected !== log.hash) {
            console.error(`[AUDIT] Tampered Row: Log ${log.id} hash mismatch`)
            return {
                isValid: false,
                brokenAt: log.id,
                report: createChainFailureReport({
                    logs,
                    sortedLogs: sorted,
                    brokenLog: log,
                    expectedPrevHash,
                    expectedHash: expected,
                    reason: 'hash_mismatch',
                }),
            }
        }

        expectedPrevHash = log.hash
    }

    return { isValid: true, brokenAt: null }
}

export function buildGlobalMerkleTree(allEntityLogs: AuditLog[]): MerkleTree {
    const sorted = [...allEntityLogs].sort(compareAuditLogs)

    const leaves = sorted.map(log => Buffer.from(log.hash, 'hex'))

    return new MerkleTree(leaves, sha256, { 
        sortPairs: true,
        hashLeaves: false,
        duplicateOdd: false 
    })
}

export type MerkleProofCheck = {
    isValid: boolean
    proofArray: string[]
    root: string
    leafHash: string | null
    reason?: string
}

export type AuditSealReference = {
    root_hash: string
    log_count: number
    created_at?: Date | string
}

export type SealedMerkleProofCheck = MerkleProofCheck & {
    isSealed: boolean
    sealedAt: Date | string | null
    sealedLogCount: number | null
    rebuiltRootMatchesSeal: boolean
}

export function checkCurrentProof(
    allEntityLogs: AuditLog[],
    latestFormLog: AuditLog
): MerkleProofCheck {
    if (allEntityLogs.length === 0) {
        return {
            isValid: false,
            proofArray: [],
            root: '',
            leafHash: null,
            reason: 'No audit logs found for this entity.',
        }
    }

    const targetExists = allEntityLogs.some(log => log.id === latestFormLog.id)
    if (!targetExists) {
        return {
            isValid: false,
            proofArray: [],
            root: '',
            leafHash: latestFormLog.hash,
            reason: 'Latest form log is not present in the current entity audit logs.',
        }
    }

    const tree = buildGlobalMerkleTree(allEntityLogs)
    const root = tree.getHexRoot()
    const leaf = Buffer.from(latestFormLog.hash, 'hex')
    const proof = tree.getProof(leaf)

    return {
        isValid: tree.verify(proof, leaf, root),
        proofArray: proof.map((entry) => entry.data.toString('hex')),
        root,
        leafHash: latestFormLog.hash,
    }
}

export function checkSealedProof(
    allEntityLogs: AuditLog[],
    latestFormLog: AuditLog,
    lastSeal: AuditSealReference | null | undefined
): SealedMerkleProofCheck {
    if (!lastSeal) {
        return {
            isValid: false,
            isSealed: false,
            proofArray: [],
            root: '',
            leafHash: latestFormLog.hash,
            sealedAt: null,
            sealedLogCount: null,
            rebuiltRootMatchesSeal: false,
            reason: 'No official seal exists yet.',
        }
    }

    if (allEntityLogs.length < lastSeal.log_count) {
        return {
            isValid: false,
            isSealed: false,
            proofArray: [],
            root: lastSeal.root_hash,
            leafHash: latestFormLog.hash,
            sealedAt: lastSeal.created_at ?? null,
            sealedLogCount: lastSeal.log_count,
            rebuiltRootMatchesSeal: false,
            reason: 'The current audit log has fewer entries than the last official seal.',
        }
    }

    const sealedLogs = allEntityLogs.slice(0, lastSeal.log_count)
    const isSealed = sealedLogs.some(log => log.id === latestFormLog.id)

    if (!isSealed) {
        return {
            isValid: false,
            isSealed: false,
            proofArray: [],
            root: lastSeal.root_hash,
            leafHash: latestFormLog.hash,
            sealedAt: lastSeal.created_at ?? null,
            sealedLogCount: lastSeal.log_count,
            rebuiltRootMatchesSeal: false,
            reason: 'Latest form log is not included in the last official seal yet.',
        }
    }

    const sealedTree = buildGlobalMerkleTree(sealedLogs)
    const rebuiltRoot = sealedTree.getHexRoot()
    const rebuiltRootMatchesSeal = rebuiltRoot === lastSeal.root_hash

    if (!rebuiltRootMatchesSeal) {
        return {
            isValid: false,
            isSealed: true,
            proofArray: [],
            root: rebuiltRoot,
            leafHash: latestFormLog.hash,
            sealedAt: lastSeal.created_at ?? null,
            sealedLogCount: lastSeal.log_count,
            rebuiltRootMatchesSeal,
            reason: 'Rebuilt sealed root does not match the official seal.',
        }
    }

    const leaf = Buffer.from(latestFormLog.hash, 'hex')
    const proof = sealedTree.getProof(leaf)

    return {
        isValid: sealedTree.verify(proof, leaf, lastSeal.root_hash),
        isSealed: true,
        proofArray: proof.map((entry) => entry.data.toString('hex')),
        root: lastSeal.root_hash,
        leafHash: latestFormLog.hash,
        sealedAt: lastSeal.created_at ?? null,
        sealedLogCount: lastSeal.log_count,
        rebuiltRootMatchesSeal,
    }
}

export function checkMerkleProofForEntry(
    logs: AuditLog[],
    targetLog: AuditLog
): MerkleProofCheck {
    if (logs.length === 0) {
        return {
            isValid: false,
            proofArray: [],
            root: '',
            leafHash: null,
            reason: 'No audit logs found.',
        }
    }

    const tree = buildGlobalMerkleTree(logs)
    const root = tree.getHexRoot()
    const leaf = Buffer.from(targetLog.hash, 'hex')
    const proof = tree.getProof(leaf)

    return {
        isValid: tree.verify(proof, leaf, root),
        proofArray: proof.map((entry) => entry.data.toString('hex')),
        root,
        leafHash: targetLog.hash,
    }
}
