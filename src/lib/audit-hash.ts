import { createHash } from "crypto"
import { AuditLog, AuditEventType, AuditLogEntryPayload } from "../types/audit"
import { canonicalStringify } from "./canonical"
import { MerkleTree } from "merkletreejs"

export function sha256(data: string): Buffer {
    return createHash('sha256').update(data).digest()
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
    return createHash('sha256').update(stringEntry).digest('hex')
}

export function buildSignaturePayload(log: {
    entity_id: string
    user_id: string
    event_type: AuditEventType
    table_name: string | null
    record_id: string | null
    payload: Record<string, unknown> | string | null
    changed_at: string
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

export function hashFormData(data: Record<string, unknown>): string {
    return createHash('sha256')
        .update(canonicalStringify(data))
        .digest('hex')
}

export function verifyChain(logs: AuditLog[]): {
    isValid: boolean,
    brokenAt: string | null
} {
    const sorted = [...logs].sort(
        (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    )

    for (const log of sorted) {
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
            return { isValid: false, brokenAt: log.id }
        }
    }

    return { isValid: true, brokenAt: null }
}

export function buildGlobalMerkleTree(allEntityLogs: AuditLog[]): MerkleTree {
    const sorted = [...allEntityLogs].sort(
        (a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
    )

    const leaves = sorted.map(log => Buffer.from(log.hash, 'hex'))

    return new MerkleTree(leaves, sha256, { 
        sortPairs: true,
        hashLeaves: false,
        duplicateOdd: false 
    })
}

export function verifySpecificLogProof(
    allEntityLogs: AuditLog[], 
    targetLog: AuditLog
): { isValid: boolean, proof: string[], root: string } {
    
    // Build the global merkle tree
    const tree = buildGlobalMerkleTree(allEntityLogs)
    const root = tree.getHexRoot()

    // Extract the proof for just this one specific log
    const leaf = Buffer.from(targetLog.hash, 'hex')
    const proof = tree.getProof(leaf)

    // Verify it against the global root
    const isValid = tree.verify(proof, leaf, root)

    return { 
        isValid, 
        proof: proof.map(p => p.data.toString('hex')), 
        root 
    }
}