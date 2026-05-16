import { db } from "../database"
import { Kysely, sql, Transaction } from "kysely"
import {
    sha256,
    computeAuditEntryHash,
    verifyChain,
    verifyChainSegment,
    buildGlobalMerkleTree,
    buildSignaturePayload,
} from "@/src/lib/audit-hash"
import { verifySignature } from "@/src/lib/crypto"
import { 
    AuditLog, 
    NewAuditLog,
    SignaturePayload,
    AuditLogEntryPayload,
    AuditEventType,
    FormSignaturePayload,
    REQUIRES_SIGNATURE,
    SignedAuditEventType,
} from "../../../types/audit"
import { canonicalStringify } from "@/src/lib/canonical"
import { replayDiffs } from "@/src/lib/diff"
import isEqual from "lodash/isEqual"
import { fetchHydratedFormState } from "./formHydrator"
import { cleanDataBasedOnTable } from "@/src/lib/validations"
import { Diff } from "@/src/types/audit"
import type { Signatory } from "@/src/types/keys"
import type { Database } from "@/src/types"
import { getNextStatus, getWorkflow, type Workflow } from "@/src/lib/workflows"
import * as keyRepository from "./keyRepository"
import * as budgetAllocationRepository from "./budgetAllocationRepository"

type DbExecutor = Kysely<Database> | Transaction<Database>
type SignedAuditLog = AuditLog & {
    event_type: SignedAuditEventType
    payload: FormSignaturePayload | null
}

async function runInTransaction<T>(
    executor: DbExecutor,
    callback: (trx: Transaction<Database>) => Promise<T>
): Promise<T> {
    if (executor.isTransaction) {
        return await callback(executor as Transaction<Database>)
    }

    return await executor.transaction().execute(callback)
}

async function acquireEntityAuditAdvisoryLock(
    executor: Transaction<Database>,
    entityId: string
) {
    await sql`
        select pg_advisory_xact_lock(hashtextextended(${entityId}, 0))
    `.execute(executor)
}

function isSignedAuditEvent(eventType: AuditEventType): eventType is SignedAuditEventType {
    return eventType === 'SIGN' || eventType === 'APPROVE_FORM' || eventType === 'REJECT_FORM'
}

function getWorkflowActionForEvent(eventType: SignedAuditEventType): 'approve' | 'reject' {
    return eventType === 'REJECT_FORM' ? 'reject' : 'approve'
}

function didTimestampsMatch(left: Date | string, right: Date | string) {
    return new Date(left).getTime() === new Date(right).getTime()
}

function findMatchingPreloadedSignatory(params: {
    signatories: Signatory[]
    userId: string
    eventType: SignedAuditEventType
    signature: string
    changedAt: Date | string
}) {
    const changedAtTime = new Date(params.changedAt).getTime()

    return params.signatories.find((signatory) =>
        signatory.user_id === params.userId &&
        signatory.event_type === params.eventType &&
        signatory.signature === params.signature &&
        new Date(signatory.created_at).getTime() === changedAtTime
    ) ?? null
}

async function verifySignedAuditEventAgainstSignatory(params: {
    log: SignedAuditLog
    workflow: Workflow
    reconstructedState: unknown
    tableName: string
    usedSignatoryIds: Set<string>
    signatories: Signatory[]
}) {
    const { log, workflow, reconstructedState, tableName, usedSignatoryIds, signatories } = params
    const payload = log.payload

    if (!payload) {
        return {
            matched: false,
            cryptographicValid: false,
            authorizationValid: false,
            formStateHashValid: false,
        }
    }

    const matchingSignatory = findMatchingPreloadedSignatory({
        signatories,
        userId: log.user_id,
        eventType: log.event_type,
        signature: log.signature ?? '',
        changedAt: log.changed_at,
    })

    if (!matchingSignatory || usedSignatoryIds.has(matchingSignatory.id)) {
        return {
            matched: false,
            cryptographicValid: false,
            authorizationValid: false,
            formStateHashValid: false,
        }
    }

    usedSignatoryIds.add(matchingSignatory.id)

    const expectedPayload = buildSignaturePayload({
        entity_id: log.entity_id,
        user_id: log.user_id,
        event_type: log.event_type,
        table_name: log.table_name,
        record_id: log.record_id,
        payload,
        changed_at: new Date(log.changed_at),
    })

    const cleanedReconstructedState = cleanDataBasedOnTable(tableName, reconstructedState)
    const actualHash = await sha256(canonicalStringify(cleanedReconstructedState))
    const cryptographicValid = await verifySignature(
        matchingSignatory.signature_payload,
        matchingSignatory.signature,
        matchingSignatory.public_key_snapshot
    )

    const transition = workflow.transitions[payload.from_status]
    const workflowAction = getWorkflowActionForEvent(log.event_type)
    const expectedNextStatus = getNextStatus(payload.from_status, workflow, workflowAction)
    const expectedSignatoryRole = transition?.signatory_role ?? null
    const allowedAccessLevels = transition?.allowed_access_levels ?? []

    const signatorySnapshotMatches =
        matchingSignatory.target_table === 'forms' &&
        matchingSignatory.target_record_id === (log.record_id ?? '') &&
        matchingSignatory.source_record_id === (log.record_id ?? '') &&
        matchingSignatory.user_id === log.user_id &&
        matchingSignatory.event_type === log.event_type &&
        matchingSignatory.signature === log.signature &&
        matchingSignatory.public_key_snapshot === log.public_key_snapshot &&
        matchingSignatory.signature_payload === expectedPayload &&
        matchingSignatory.form_state_hash === payload.form_state_hash &&
        matchingSignatory.from_status === payload.from_status &&
        matchingSignatory.to_status === payload.to_status &&
        (matchingSignatory.remarks ?? null) === (payload.remarks ?? null) &&
        didTimestampsMatch(matchingSignatory.created_at, log.changed_at)

    const formStateHashValid =
        actualHash === payload.form_state_hash &&
        matchingSignatory.form_state_hash === actualHash

    const authorizationValid =
        !!transition &&
        expectedNextStatus === payload.to_status &&
        expectedSignatoryRole !== null &&
        matchingSignatory.role === expectedSignatoryRole &&
        matchingSignatory.signer_workflow_role === expectedSignatoryRole &&
        allowedAccessLevels.includes(matchingSignatory.signer_access_level)

    return {
        matched: signatorySnapshotMatches,
        cryptographicValid,
        authorizationValid,
        formStateHashValid,
    }
}

export async function createLogWithExecutor(
    executor: DbExecutor,
    log: Omit<NewAuditLog, 'hash'>,
    signingPayload: SignaturePayload | string | null
): Promise<AuditLog> {
    return await runInTransaction(executor, async (trx) => {
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

        if ((process.env.AUDIT_DISABLE_ADVISORY_LOCK || '') !== 'true') {
            await acquireEntityAuditAdvisoryLock(trx, log.entity_id)
        }

        const lastLog = await trx
            .selectFrom('audit_logs')
            .select(['hash', 'changed_at'])
            .where('entity_id', '=', log.entity_id)
            .orderBy('changed_at', 'desc')
            .orderBy('id', 'desc')
            .limit(1)
            .forUpdate()
            .executeTakeFirst()

        const prevHash = lastLog ? lastLog.hash : null
        const changedAt = requiresSignature && log.changed_at
            ? new Date(log.changed_at)
            : new Date()

        if (lastLog && changedAt.getTime() <= new Date(lastLog.changed_at).getTime()) {
            if (requiresSignature) {
                throw new Error(
                    `${log.event_type} timestamp must be strictly newer than the latest audit log for this entity. Please retry the signature.`
                )
            }

            changedAt.setTime(new Date(lastLog.changed_at).getTime() + 1)
        }

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

export async function createLog(log: Omit<NewAuditLog, 'hash'>, signingPayload: SignaturePayload | string | null): Promise<AuditLog> {
    return await createLogWithExecutor(db, log, signingPayload)
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
        .orderBy('audit_logs.id', 'asc')
        .execute()
}

export async function verifyEntityChain(entityId: string) {
    const logs = await db
        .selectFrom('audit_logs')
        .selectAll()
        .where('entity_id', '=', entityId)
        .orderBy('changed_at', 'asc')
        .orderBy('id', 'asc')
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
        .orderBy('id', 'asc')
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

    // Run ledger integrity and state reconstruction in parallel
    const [chainResult, stateResult] = await Promise.all([
        // Verify the chain
        Promise.resolve(
            lastSeal && isSealedRootValid
                ? verifyChainSegment(
                    postSealLogs,
                    sealedLogs.length > 0 ? sealedLogs[sealedLogs.length - 1].hash : null
                )
                : verifyChain(allEntityLogs)
        ),

        // Verify the data state
        (async () => {
            let isDataMatch = false
            let reconstructedState = null
            let currentState = null
            let approvalHashesValid = true
            let snapshotsMatchHistory = true
            let signatureEventsValid = true
            let signatoryRowsValid = true
            let authorizationSnapshotsValid = true

            if (formLogs.length === 0) {
                return {
                    isMissingCurrentState: false,
                    isDataMatch,
                    debugState: {
                        reconstructedState,
                        currentState,
                        approvalHashesValid,
                        snapshotsMatchHistory,
                        signatureEventsValid,
                        signatoryRowsValid,
                        authorizationSnapshotsValid,
                        isDataMatch,
                    },
                }
            }

            const [hydratedState, targetSignatories, formRecord] = await Promise.all([
                fetchHydratedFormState(tableName, recordId),
                keyRepository.listSignatoriesByTarget('forms', recordId),
                db
                    .selectFrom('forms')
                    .select(['id', 'type'])
                    .where('id', '=', recordId)
                    .executeTakeFirst(),
            ])
            currentState = hydratedState
            const workflow = formRecord ? getWorkflow(formRecord.type) : null
            const usedSignatoryIds = new Set<string>()

            if (!currentState) {
                return {
                    isMissingCurrentState: true,
                    isDataMatch: false,
                    debugState: { error: "Form missing from database." },
                }
            }

            for (const log of formLogsWithProofs) {
                const payload = log.payload as Record<string, unknown>

                if (log.event_type === 'CREATE_FORM') {
                    reconstructedState = JSON.parse(JSON.stringify(payload))
                }
                else if (log.event_type === 'EDIT_FORM') {
                    if (reconstructedState) {
                        reconstructedState = replayDiffs(reconstructedState, [payload as Diff])
                    }
                }
                else if (log.event_type === 'SUBMIT_FORM') {
                    if (reconstructedState) {
                        const cleanedPayload = cleanDataBasedOnTable(tableName, payload)
                        const cleanedReconstructedState = cleanDataBasedOnTable(tableName, reconstructedState)

                        const historyMatch = isEqual(cleanedReconstructedState, cleanedPayload)
                        if (!historyMatch) {
                            snapshotsMatchHistory = false
                            console.log(`[AUDIT] Broken Snapshot: Log ${log.id} expected state ${JSON.stringify(cleanedReconstructedState)} BUT GOT ${JSON.stringify(cleanedPayload)}`)
                        }
                    } else {
                        snapshotsMatchHistory = false
                    }

                    reconstructedState = JSON.parse(canonicalStringify(payload))

                }
                else if (isSignedAuditEvent(log.event_type)) {
                    if (!workflow || !reconstructedState) {
                        signatureEventsValid = false
                        signatoryRowsValid = false
                        authorizationSnapshotsValid = false
                        approvalHashesValid = false
                        continue
                    }

                    const verificationResult = await verifySignedAuditEventAgainstSignatory({
                        log: log as SignedAuditLog,
                        workflow,
                        reconstructedState,
                        tableName,
                        usedSignatoryIds,
                        signatories: targetSignatories,
                    })

                    if (!verificationResult.formStateHashValid) {
                        console.log(`[AUDIT] Broken Approval Hash: Log ${log.id} with event type ${log.event_type} expected reconstructed state hash to match signed form_state_hash ${payload?.form_state_hash ?? 'missing'}. Reconstructed state: ${JSON.stringify(reconstructedState)}`)
                        approvalHashesValid = false
                    }
                    if (!verificationResult.cryptographicValid) {
                        signatureEventsValid = false
                    }
                    if (!verificationResult.matched) {
                        signatoryRowsValid = false
                    }
                    if (!verificationResult.authorizationValid) {
                        authorizationSnapshotsValid = false
                    }
                }
            }

            const cleanedReconstructedState = reconstructedState
                ? cleanDataBasedOnTable(tableName, reconstructedState)
                : null

            const cleanedCurrentState = currentState
                ? cleanDataBasedOnTable(tableName, currentState)
                : null

            isDataMatch =
                !!cleanedReconstructedState &&
                isEqual(cleanedReconstructedState, cleanedCurrentState) &&
                approvalHashesValid &&
                snapshotsMatchHistory &&
                signatureEventsValid &&
                signatoryRowsValid &&
                authorizationSnapshotsValid

            return {
                isMissingCurrentState: false,
                isDataMatch,
                debugState: {
                    reconstructedState,
                    currentState,
                    approvalHashesValid,
                    snapshotsMatchHistory,
                    signatureEventsValid,
                    signatoryRowsValid,
                    authorizationSnapshotsValid,
                    isDataMatch,
                },
            }
        })(),
    ])

    return {
        isTimelineIntact: chainResult.isValid,
        isSealedRootValid: isSealedRootValid,
        timelineBrokenAt: chainResult.brokenAt,
        chainFailureReport: chainResult.report ?? null,
        isDataMatch: stateResult.isMissingCurrentState ? false : stateResult.isDataMatch,
        currentGlobalRoot: currentGlobalRoot,
        lastSealedRoot: lastSeal?.root_hash || null,
        totalEntityEvents: allEntityLogs.length,
        formEventCount: formLogs.length,
        formLogs: formLogsWithProofs,
        debugState: stateResult.debugState
    }
}

export async function verifyAllocationSignoffIntegrity(
    fiscalYear: number,
    signoffType: 'nep' | 'gaa'
) {
    const signoffRecordId = `${signoffType}:${fiscalYear}`

    const firstLog = await db
        .selectFrom('audit_logs')
        .select('entity_id')
        .where('table_name', '=', 'budget_allocations')
        .where('record_id', '=', signoffRecordId)
        .limit(1)
        .executeTakeFirst()

    if (!firstLog) return null

    const lastSeal = await db
        .selectFrom('merkle_roots')
        .selectAll()
        .where('entity_id', '=', firstLog.entity_id)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst()

    const allEntityLogs = await db
        .selectFrom('audit_logs')
        .selectAll()
        .where('entity_id', '=', firstLog.entity_id)
        .orderBy('changed_at', 'asc')
        .orderBy('id', 'asc')
        .execute()

    let isSealedRootValid = true
    const sealedLogCount = lastSeal?.log_count ?? 0
    const sealedLogs = lastSeal ? allEntityLogs.slice(0, sealedLogCount) : []
    const postSealLogs = lastSeal ? allEntityLogs.slice(sealedLogCount) : allEntityLogs

    if (lastSeal && allEntityLogs.length < sealedLogCount) {
        isSealedRootValid = false
    }

    const chainResult =
        lastSeal && isSealedRootValid
            ? verifyChainSegment(
                postSealLogs,
                sealedLogs.length > 0 ? sealedLogs[sealedLogs.length - 1].hash : null
            )
            : verifyChain(allEntityLogs)

    const signoffLogs = allEntityLogs.filter(
        (log) => log.table_name === 'budget_allocations' && log.record_id === signoffRecordId
    )
    const logIndexMap = new Map(allEntityLogs.map((log, index) => [log.id, index]))
    const currentGlobalRoot = lastSeal?.root_hash ?? null

    const signoffLogsWithProofs = signoffLogs.map((log) => {
        const logIndex = logIndexMap.get(log.id) ?? -1
        const isSealed = lastSeal ? logIndex > -1 && logIndex < sealedLogCount : false

        return {
            ...log,
            isSealed,
            cryptographic_proof: null,
        }
    })

    const [currentState, targetSignatories] = await Promise.all([
        budgetAllocationRepository.getAllocationSignoffSnapshot(
            fiscalYear,
            signoffType
        ),
        keyRepository.listSignatoriesByTarget('budget_cycles', String(fiscalYear)),
    ])

    const currentHash = await sha256(canonicalStringify(currentState))
    const workflow = getWorkflow(signoffType)
    const usedSignatoryIds = new Set<string>()
    let cryptographicValid = true
    let signatoryRowsValid = true
    let authorizationSnapshotsValid = true
    let stateHashValid = true

    for (const log of signoffLogsWithProofs) {
        if (!isSignedAuditEvent(log.event_type)) {
            continue
        }

        const payload = log.payload as FormSignaturePayload | null
        if (!payload) {
            cryptographicValid = false
            signatoryRowsValid = false
            authorizationSnapshotsValid = false
            stateHashValid = false
            continue
        }

        const matchingSignatory = findMatchingPreloadedSignatory({
            signatories: targetSignatories,
            userId: log.user_id,
            eventType: log.event_type,
            signature: log.signature ?? '',
            changedAt: log.changed_at,
        })

        if (!matchingSignatory || usedSignatoryIds.has(matchingSignatory.id)) {
            cryptographicValid = false
            signatoryRowsValid = false
            authorizationSnapshotsValid = false
            stateHashValid = false
            continue
        }

        usedSignatoryIds.add(matchingSignatory.id)

        const expectedPayload = buildSignaturePayload({
            entity_id: log.entity_id,
            user_id: log.user_id,
            event_type: log.event_type,
            table_name: log.table_name,
            record_id: log.record_id,
            payload,
            changed_at: new Date(log.changed_at),
        })

        const transition = workflow.transitions[payload.from_status]
        const workflowAction = getWorkflowActionForEvent(log.event_type)
        const expectedNextStatus = getNextStatus(payload.from_status, workflow, workflowAction)
        const expectedSignatoryRole = transition?.signatory_role ?? null
        const allowedAccessLevels = transition?.allowed_access_levels ?? []

        const signatureStillValid = await verifySignature(
            matchingSignatory.signature_payload,
            matchingSignatory.signature,
            matchingSignatory.public_key_snapshot
        )

        const sourceRecordIdMatches = matchingSignatory.source_record_id === signoffRecordId

        if (!signatureStillValid) {
            cryptographicValid = false
        }

        if (
            matchingSignatory.target_table !== 'budget_cycles' ||
            matchingSignatory.target_record_id !== String(fiscalYear) ||
            matchingSignatory.user_id !== log.user_id ||
            matchingSignatory.event_type !== log.event_type ||
            matchingSignatory.signature !== log.signature ||
            matchingSignatory.public_key_snapshot !== log.public_key_snapshot ||
            matchingSignatory.signature_payload !== expectedPayload ||
            !sourceRecordIdMatches ||
            matchingSignatory.form_state_hash !== payload.form_state_hash ||
            matchingSignatory.from_status !== payload.from_status ||
            matchingSignatory.to_status !== payload.to_status ||
            (matchingSignatory.remarks ?? null) !== (payload.remarks ?? null) ||
            !didTimestampsMatch(matchingSignatory.created_at, log.changed_at)
        ) {
            signatoryRowsValid = false
        }

        if (
            !transition ||
            expectedNextStatus !== payload.to_status ||
            expectedSignatoryRole === null ||
            matchingSignatory.role !== expectedSignatoryRole ||
            matchingSignatory.signer_workflow_role !== expectedSignatoryRole ||
            !allowedAccessLevels.includes(matchingSignatory.signer_access_level)
        ) {
            authorizationSnapshotsValid = false
        }

        if (payload.form_state_hash !== currentHash || matchingSignatory.form_state_hash !== currentHash) {
            stateHashValid = false
        }
    }

    const isDataMatch =
        signoffLogs.length > 0 &&
        cryptographicValid &&
        signatoryRowsValid &&
        authorizationSnapshotsValid &&
        stateHashValid

    return {
        isTimelineIntact: chainResult.isValid,
        isSealedRootValid,
        timelineBrokenAt: chainResult.brokenAt,
        chainFailureReport: chainResult.report ?? null,
        isDataMatch,
        currentGlobalRoot,
        lastSealedRoot: lastSeal?.root_hash || null,
        totalEntityEvents: allEntityLogs.length,
        formEventCount: signoffLogs.length,
        formLogs: signoffLogsWithProofs,
        debugState: {
            currentState,
            cryptographicValid,
            signatoryRowsValid,
            authorizationSnapshotsValid,
            stateHashValid,
            isDataMatch,
        },
    }
}

export async function sealDailyAuditLog(entityId: string) {
    const allEntityLogs = await db
        .selectFrom('audit_logs')
        .selectAll()
        .where('entity_id', '=', entityId)
        .orderBy('changed_at', 'asc')
        .orderBy('id', 'asc')
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
        .orderBy('id', 'asc')
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
        .orderBy('id', 'asc')
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
        .orderBy('audit_logs.id', 'desc')
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
