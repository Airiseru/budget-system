import { db } from "../database"
import { Kysely, Transaction } from "kysely"
import {
    sha256,
    computeAuditEntryHash,
    verifyChain,
    verifyChainSegment,
    buildGlobalMerkleTree
} from "@/src/lib/audit-hash"
import { verifySignature } from "@/src/lib/crypto"
import { 
    AuditLog, 
    NewAuditLog,
    SignaturePayload,
    AuditLogEntryPayload,
    AuditEventType,
    FormSignaturePayload,
    REQUIRES_SIGNATURE
} from "../../../types/audit"
import { canonicalStringify } from "@/src/lib/canonical"
import { replayDiffs } from "@/src/lib/diff"
import isEqual from "lodash/isEqual"
import { fetchHydratedFormState } from "./formHydrator"
import { cleanDataBasedOnTable } from "@/src/lib/validations"
import { Diff } from "@/src/types/audit"
import type { Database } from "@/src/types"

type DbExecutor = Kysely<Database> | Transaction<Database>

async function createLogWithExecutor(
    executor: DbExecutor,
    log: Omit<NewAuditLog, 'hash'>,
    signingPayload: SignaturePayload | string | null
): Promise<AuditLog> {
    const editedLog: NewAuditLog = {
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
            throw new Error(`${log.event_type} requires a digital signature`)
        }

        const isValid = await verifySignature(
            signingPayload,
            log.signature,
            log.public_key_snapshot
        )

        if (!isValid) throw new Error('Invalid digital signature')
    }

    const lastLog = await executor
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

    return await executor
        .insertInto('audit_logs')
        .values({
            ...editedLog,
            payload: log.payload ? canonicalStringify(log.payload) : null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function createLog(log: Omit<NewAuditLog, 'hash'>, signingPayload: SignaturePayload | string | null): Promise<AuditLog> {
    return await db.transaction().execute(async (trx) => {
        return await createLogWithExecutor(trx, log, signingPayload)
    })
}

export { createLogWithExecutor }

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

    // Standard verification does not rebuild Merkle trees.
    // We only treat the published seal as usable if enough logs still exist
    // to cover the sealed checkpoint.
    let isSealedRootValid = true
    const sealedLogCount = lastSeal?.log_count ?? 0
    const sealedLogs = lastSeal ? allEntityLogs.slice(0, sealedLogCount) : []
    const postSealLogs = lastSeal ? allEntityLogs.slice(sealedLogCount) : allEntityLogs
    
    if (lastSeal) {
        if (allEntityLogs.length < sealedLogCount) {
            isSealedRootValid = false
        }
    }

    const chainResult =
        lastSeal && isSealedRootValid
            ? verifyChainSegment(
                postSealLogs,
                sealedLogs.length > 0 ? sealedLogs[sealedLogs.length - 1].hash : null
            )
            : verifyChain(allEntityLogs)

    const formLogs = allEntityLogs.filter(
        l => l.table_name === tableName && l.record_id === recordId
    )
    const logIndexMap = new Map(allEntityLogs.map((log, index) => [log.id, index]))
    const currentGlobalRoot = lastSeal?.root_hash ?? null

    const formLogsWithProofs = formLogs.map(log => {
        const logIndex = logIndexMap.get(log.id) ?? -1
        const isSealed = lastSeal ? logIndex > -1 && logIndex < sealedLogCount : false

        return {
            ...log,
            isSealed,
            cryptographic_proof: null
        }
    })

    // Verify form data matches with changes stored in audit logs
    let isDataMatch = false
    let reconstructedState = null
    let currentState = null
    let approvalHashesValid = true
    let snapshotsMatchHistory = true

    if (formLogs.length > 0) {
        currentState = await fetchHydratedFormState(tableName, recordId)

        if (!currentState) {
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
            const payload = log.payload as Record<string, unknown>

            if (log.event_type === 'CREATE_FORM') {
                reconstructedState = JSON.parse(JSON.stringify(payload))
                console.log(`CREATE FORM RECONSTRUCTED STATE:`, reconstructedState)
            }
            else if (log.event_type === 'EDIT_FORM') {
                // Delta: Apply diff to current reconstructed state
                if (reconstructedState) {
                    reconstructedState = replayDiffs(reconstructedState, [payload as Diff])
                }
            }
            else if (log.event_type === 'SUBMIT_FORM') {
                // Compare signed snapshot to current reconstructed state
                if (reconstructedState) {
                    // Clean payload to remove id and foreign keys
                    console.log('payload', payload)
                    const cleanedPayload = cleanDataBasedOnTable(tableName, payload)
                    console.log('cleaned payload is ok')
                    console.log(`reconstructed state: ${JSON.stringify(reconstructedState)}`)

                    const cleanedReconstructedState = cleanDataBasedOnTable(tableName, reconstructedState)
                    console.log('cleaned reconstructed state is ok')

                    const historyMatch = isEqual(cleanedReconstructedState, cleanedPayload)
                    if (!historyMatch) {
                        snapshotsMatchHistory = false
                    }
                } else {
                    snapshotsMatchHistory = false
                }
                
                // Reset the reconstructed state since it was signed
                reconstructedState = JSON.parse(canonicalStringify(payload))

            }
            else if (log.event_type === 'APPROVE_FORM' || log.event_type === 'SIGN') {
                // Approval: Verify the user signed the correct state hash
                if (reconstructedState && payload.form_state_hash) {
                    const actualHash = await sha256(canonicalStringify(cleanDataBasedOnTable(tableName, reconstructedState)))

                    console.log('actualHash', actualHash)
                    console.log('payload.form_state_hash', payload.form_state_hash)

                    if (actualHash !== payload.form_state_hash) {
                        approvalHashesValid = false
                    }
                }
            }
        }

        // Clean the reconstructed state to remove ids and foreign keys
        const cleanedReconstructedState = reconstructedState
            ? cleanDataBasedOnTable(tableName, reconstructedState)
            : null
        
        console.log('current state', currentState)
        console.log('reconstructed state', cleanedReconstructedState)
        
        // Compare the reconstructed state to the current state
        isDataMatch = !!cleanedReconstructedState && isEqual(cleanedReconstructedState, currentState) && approvalHashesValid && snapshotsMatchHistory
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
        debugState: { reconstructedState, currentState, approvalHashesValid, snapshotsMatchHistory, isDataMatch }
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

export async function generateMerkleProofForEntry(entityId: string, logId: string) {
    const lastSeal = await db
        .selectFrom('merkle_roots')
        .selectAll()
        .where('entity_id', '=', entityId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst()

    if (!lastSeal) throw new Error('No seal exists yet — cannot generate proof')

    const sealedLogs = await db
        .selectFrom('audit_logs')
        .selectAll()
        .where('entity_id', '=', entityId)
        .orderBy('changed_at', 'asc')
        .limit(lastSeal.log_count)
        .execute()

    const tree = buildGlobalMerkleTree(sealedLogs)
    const index = sealedLogs.findIndex(l => l.id === logId)
    if (index === -1) throw new Error('Entry not found in sealed logs')

    const leaf = Buffer.from(sealedLogs[index].hash, 'hex')
    const proof = tree.getProof(leaf, index)

    return {
        entryId: logId,
        leaf: sealedLogs[index].hash,
        proof: proof.map(p => p.data.toString('hex')),
        root: lastSeal.root_hash,
        sealedAt: lastSeal.created_at,
    }
}

export async function getPayloadOfFormSignEvent(
    userId: string,
    entityId: string,
    tableName: string,
    formId: string,
): Promise<FormSignaturePayload | string> {
    const result = await db.
        selectFrom('audit_logs')
        .where('entity_id', '=', entityId)
        .where('table_name', '=', tableName)
        .where('record_id', '=', formId)
        .where(({ eb, or }) => or([
            eb('event_type', '=', 'SIGN'),
            eb('event_type', '=', 'REJECT_FORM')
        ]))
        .select(['payload', 'event_type', 'user_id'])
        .orderBy('changed_at', 'asc')
        .execute()

    console.log(`RESULT IN PAYLOAD OF SIGN EVENT: ${JSON.stringify(result)}`)

    let currentSignPayload: FormSignaturePayload | null = null
    let currentCycleSignCount = 0

    for (const log of result) {
        const payload = log.payload as FormSignaturePayload | null

        if (log.event_type === 'REJECT_FORM') {
            currentSignPayload = null
            currentCycleSignCount = 0
            continue
        }

        if (log.event_type === 'SIGN' && log.user_id === userId) {
            currentSignPayload = payload
            currentCycleSignCount += 1
        }
    }

    if (!currentSignPayload) return "Form not signed by user"

    if (currentCycleSignCount > 1) return "Multiple signatures of user found for form"

    return currentSignPayload
}

export async function getLatestFormRejection(tableName: string, recordId: string) {
    const result = await db
        .selectFrom('audit_logs')
        .leftJoin('users', 'users.id', 'audit_logs.user_id')
        .select([
            'audit_logs.payload',
            'audit_logs.changed_at',
            'users.name as user_name',
        ])
        .where('audit_logs.table_name', '=', tableName)
        .where('audit_logs.record_id', '=', recordId)
        .where('audit_logs.event_type', '=', 'REJECT_FORM')
        .orderBy('audit_logs.changed_at', 'desc')
        .limit(1)
        .executeTakeFirst()

    if (!result) return null

    const payload = result.payload as FormSignaturePayload | null

    return {
        remarks: payload?.remarks?.trim() || null,
        changed_at: result.changed_at,
        user_name: result.user_name ?? null,
        to_status: payload?.to_status ?? null,
    }
}
