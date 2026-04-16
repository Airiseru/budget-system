import { db } from "../database"
import {
    sha256,
    computeAuditEntryHash,
    verifyChain,
    buildGlobalMerkleTree,
} from "@/src/lib/audit-hash"
import { verifySignature } from "@/src/lib/crypto"
import { 
    AuditLog, 
    NewAuditLog,
    SignaturePayload,
    AuditLogEntryPayload,
    AuditEventType,
    REQUIRES_SIGNATURE
} from "../../../types/audit"
import { canonicalStringify } from "@/src/lib/canonical"
import { replayDiffs } from "@/src/lib/diff"
import isEqual from "lodash/isEqual"
import { fetchHydratedFormState } from "./formHydrator"

export async function createLog(log: Omit<NewAuditLog, 'hash'>, signingPayload: SignaturePayload | string | null): Promise<AuditLog> {
    let editedLog: NewAuditLog = {
        ...log,
        table_name: log.table_name ?? null,
        record_id: log.record_id ?? null,
        payload: log.payload ?? null,
        public_key_snapshot: log.public_key_snapshot ?? null,
        signature: log.signature ?? null,
        hash: ''
    }
    const requiresSignature = REQUIRES_SIGNATURE.includes(log.event_type as AuditEventType)

    if (requiresSignature) {
        if (!log.public_key_snapshot || !log.signature || !signingPayload) {
            console.log(`public_key_snapshot: ${!log.public_key_snapshot}`)
            console.log(`signature: ${!log.signature}`)
            console.log(`signingPayload: ${!signingPayload}`)
            throw new Error(`${log.event_type} requires a digital signature`)
        }

        const isValid = await verifySignature(
            signingPayload,
            log.signature,
            log.public_key_snapshot
        )

        if (!isValid) throw new Error('Invalid digital signature')
    }

    return await db.transaction().execute(async (trx) => {
        const lastLog = await trx
            .selectFrom('audit_logs')
            .select('hash')
            .where('entity_id', '=', log.entity_id)
            .orderBy('changed_at', 'desc')
            .limit(1)
            .forUpdate()
            .executeTakeFirst()

        const prevHash = lastLog ? lastLog.hash : null
        const changedAt = requiresSignature && log.changed_at
            ? new Date(log.changed_at)
            : new Date()
        
        const newHash = computeAuditEntryHash({
            entity_id: log.entity_id,
            user_id: log.user_id,
            event_type: log.event_type as AuditLogEntryPayload['event_type'],
            table_name: log.table_name ?? "NULL",
            record_id: log.record_id ?? "NULL",
            payload: log.payload ?? "NULL",
            changed_at: changedAt.toISOString(),
            prev_hash: prevHash ?? "NULL",
            public_key_snapshot: log.public_key_snapshot ?? "NULL",
            signature: log.signature ?? "NULL",
        })

        editedLog.changed_at = changedAt
        editedLog.prev_hash = prevHash
        editedLog.hash = newHash

        console.log(`[AUDIT] Logging ${log.event_type} with payload ${canonicalStringify(log.payload)}`)

        return await trx
            .insertInto('audit_logs')
            .values({
                ...editedLog,
                payload: log.payload ? canonicalStringify(log.payload) : null,
            })
            .returningAll()
            .executeTakeFirstOrThrow()
    })
}

export async function getHistory(tableName: string, recordId: string) {
    return await db
        .selectFrom('audit_logs')
        .leftJoin('users', 'users.id', 'audit_logs.user_id')
        .select([
            'audit_logs.id',
            'audit_logs.event_type',
            'audit_logs.payload',
            'audit_logs.changed_at',
            'audit_logs.hash',
            'audit_logs.signature',
            'users.name as user_name'
        ])
        .where('audit_logs.table_name', '=', tableName)
        .where('audit_logs.record_id', '=', recordId)
        .orderBy('audit_logs.changed_at', 'asc')
        .execute()
}

export async function verifyEntityChain(entityId: string) {
    const logs = await db
        .selectFrom('audit_logs')
        .selectAll()
        .where('entity_id', '=', entityId)
        .orderBy('changed_at', 'asc')
        .execute()

    return await verifyChain(logs)
}

export async function verifyFormIntegrity(tableName: string, recordId: string) {
    // Find the first log to figure out which Entity owns this form
    const firstLog = await db
        .selectFrom('audit_logs')
        .select('entity_id')
        .where('table_name', '=', tableName)
        .where('record_id', '=', recordId)
        .limit(1)
        .executeTakeFirst()

    if (!firstLog) return null

    // Fetch the latest OFFICIAL seal for this entity
    const lastSeal = await db
        .selectFrom('merkle_roots')
        .selectAll()
        .where('entity_id', '=', firstLog.entity_id)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst()

    // Fetch all current logs for the entity
    const allEntityLogs = await db
        .selectFrom('audit_logs')
        .selectAll()
        .where('entity_id', '=', firstLog.entity_id)
        .orderBy('changed_at', 'asc')
        .execute()
    
    // Verify the internal integrity of the audit chain
    const chainResult = verifyChain(allEntityLogs)

    // Detect rollbacks
    let isSealedRootValid = true; // Defaults to true if no seal exists yet
    
    if (lastSeal) {
        if (allEntityLogs.length < lastSeal.log_count) {
            // Someone restored an old backup to delete recent history.
            isSealedRootValid = false;
        } else {
            // Rebuild the tree exactly as it was at the moment of the last seal
            const sealedLogs = allEntityLogs.slice(0, lastSeal.log_count)
            const sealedTree = buildGlobalMerkleTree(sealedLogs)
            
            // Compare the rebuilt root against the database's official sealed root
            if (sealedTree.getHexRoot() !== lastSeal.root_hash) {
                isSealedRootValid = false
            }
        }
    }

    const formLogs = allEntityLogs.filter(
        l => l.table_name === tableName && l.record_id === recordId
    )
    const globalTree = buildGlobalMerkleTree(allEntityLogs)
    const currentGlobalRoot = globalTree.getHexRoot()

    const formLogsWithProofs = formLogs.map(log => {
        const leaf = Buffer.from(log.hash, 'hex')
        const proof = globalTree.getProof(leaf)

        return {
            ...log,
            isSealed: lastSeal ? allEntityLogs.findIndex(l => l.id === log.id) < lastSeal.log_count : false,
            cryptographic_proof: {
                isValid: globalTree.verify(proof, leaf, currentGlobalRoot),
                proofArray: proof.map(p => p.data.toString('hex')),
                root: currentGlobalRoot
            }
        }
    })

    // Verify form data matches with changes stored in audit logs
    let isDataMatch = false
    let reconstructedState = null
    let currentState = null
    let approvalHashesValid = true
    let snapshotsMatchHistory = true

    if (formLogs.length > 0) {
        const rawCurrentState = await fetchHydratedFormState(tableName, recordId)

        if (!rawCurrentState) {
            return {
                isTimelineIntact: chainResult.isValid,
                isSealedRootValid,
                timelineBrokenAt: chainResult.brokenAt,
                isDataMatch: false, 
                currentGlobalRoot,
                lastSealedRoot: lastSeal?.root_hash || null,
                totalEntityEvents: allEntityLogs.length,
                formEventCount: formLogs.length,
                formLogs: formLogsWithProofs,
                debugState: { error: "Form missing from database." }
            }
        }

        for (const log of formLogsWithProofs) {
            const payload = log.payload as any;

            if (log.event_type === 'CREATE_FORM') {
                reconstructedState = JSON.parse(JSON.stringify(payload));
            }
            else if (log.event_type === 'EDIT_FORM') {
                // Delta: Apply diff to current reconstructed state
                if (reconstructedState) {
                    reconstructedState = replayDiffs(reconstructedState, [payload]);
                }
            }
            else if (log.event_type === 'SUBMIT_FORM') {
                // Compare signed snapshot to current reconstructed state
                if (reconstructedState) {
                    const historyMatch = isEqual(reconstructedState, payload);
                    if (!historyMatch) {
                        snapshotsMatchHistory = false;
                    }
                }
                
                // Reset the reconstructed state since it was signed
                reconstructedState = JSON.parse(JSON.stringify(payload));
            }
            else if (log.event_type === 'APPROVE_FORM' || log.event_type === 'SIGN') {
                // Approval: Verify the user signed the correct state hash
                if (reconstructedState && payload.form_state_hash) {
                    const actualHash = await sha256(canonicalStringify(reconstructedState));
                    if (actualHash !== payload.form_state_hash) {
                        approvalHashesValid = false;
                    }
                }
            }
        }

        // Clean current state for comparison
        const { 
            auth_status, entity_id, created_at, updated_at,
            ...cleanCurrentState 
        } = rawCurrentState as any

        currentState = JSON.parse(JSON.stringify(cleanCurrentState))

        console.log('current state', currentState)
        console.log('reconstructed state', reconstructedState)
        
        isDataMatch = isEqual(reconstructedState, currentState) && approvalHashesValid && snapshotsMatchHistory
    }

    return {
        isTimelineIntact: chainResult.isValid,
        isSealedRootValid: isSealedRootValid,
        timelineBrokenAt: chainResult.brokenAt,
        isDataMatch: isDataMatch,
        currentGlobalRoot: currentGlobalRoot,
        lastSealedRoot: lastSeal?.root_hash || null,
        totalEntityEvents: allEntityLogs.length,
        formEventCount: formLogs.length,
        formLogs: formLogsWithProofs,
        debugState: { reconstructedState, currentState, approvalHashesValid, snapshotsMatchHistory }
    }
}

export async function sealDailyAuditLog(entityId: string) {
    const allEntityLogs = await db
        .selectFrom('audit_logs')
        .selectAll()
        .where('entity_id', '=', entityId)
        .orderBy('changed_at', 'asc')
        .execute()

    if (allEntityLogs.length === 0) return { success: false, message: 'No logs to seal' }

    // Check if there are any new logs
    const lastSeal = await db
        .selectFrom('merkle_roots')
        .select(['log_count', 'root_hash'])
        .where('entity_id', '=', entityId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst()

    if (lastSeal && lastSeal.log_count === allEntityLogs.length) {
        return { success: false, message: 'No new logs since last seal' }
    }

    const globalTree = buildGlobalMerkleTree(allEntityLogs)
    const rootHash = globalTree.getHexRoot()

    await db
        .insertInto('merkle_roots')
        .values({
            entity_id: entityId,
            root_hash: rootHash,
            log_count: allEntityLogs.length,
            created_at: new Date()
        })
        .execute()

    return { success: true, rootHash }
}