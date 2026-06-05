import { randomUUID } from 'crypto'
import { createLog, verifyEntityChain } from '../src/db/postgres/repositories/auditRepository'
import { db } from '../src/db/postgres/database'
import type { ChainVerificationResult } from '../src/lib/audit-hash'

type TestContext = {
    userId: string
    primaryEntityId: string
    secondaryEntityId: string
    concurrency: number
}

function getArgValue(name: string) {
    const prefixed = `--${name}=`
    const inline = process.argv.find((arg) => arg.startsWith(prefixed))

    if (inline) return inline.slice(prefixed.length)

    const index = process.argv.indexOf(`--${name}`)
    if (index >= 0) return process.argv[index + 1]

    return undefined
}

function getConcurrency() {
    const value = Number(getArgValue('concurrency') ?? process.env.AUDIT_TEST_CONCURRENCY ?? 50)

    if (!Number.isInteger(value) || value < 25 || value > 100) {
        throw new Error('Concurrency must be an integer from 25 to 100.')
    }

    return value
}

function shouldUseExistingFixtures() {
    return getArgValue('use-existing') === 'true' || process.env.AUDIT_TEST_USE_EXISTING === 'true'
}

async function createTestEntity() {
    return await db
        .insertInto('entities')
        .values({ type: 'audit_concurrency_test' })
        .returning('id')
        .executeTakeFirstOrThrow()
}

async function createTestUser(entityId: string, batchId: string) {
    return await db
        .insertInto('users')
        .values({
            id: `audit-concurrency-${batchId}`,
            name: 'Audit Concurrency Test User',
            email: `audit-concurrency-${batchId}@example.test`,
            email_verified: true,
            position: 'Test Runner',
            role: 'others',
            access_level: 'none',
            is_admin: false,
            entity_id: entityId,
            status: 'active',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
}

async function getFallbackUserId() {
    const user = await db
        .selectFrom('users')
        .select('id')
        .where('entity_id', 'is not', null)
        .orderBy('created_at', 'asc')
        .executeTakeFirst()

    if (!user) {
        throw new Error('No user with an entity_id was found. Pass --user-id=<id> or seed a test user first.')
    }

    return user.id
}

async function getFallbackEntityIds() {
    const entities = await db
        .selectFrom('entities')
        .select('id')
        .orderBy('id', 'asc')
        .limit(2)
        .execute()

    if (entities.length < 2) {
        throw new Error('At least two entities are required for the different-entity concurrency test.')
    }

    return {
        primaryEntityId: entities[0].id,
        secondaryEntityId: entities[1].id,
    }
}

async function resolveContext(batchId: string): Promise<TestContext> {
    if (!shouldUseExistingFixtures()) {
        const primaryEntity = await createTestEntity()
        const secondaryEntity = await createTestEntity()
        const user = await createTestUser(primaryEntity.id, batchId)

        return {
            userId: user.id,
            primaryEntityId: primaryEntity.id,
            secondaryEntityId: secondaryEntity.id,
            concurrency: getConcurrency(),
        }
    }

    const fallbackEntityIds = await getFallbackEntityIds()

    return {
        userId: getArgValue('user-id') ?? process.env.AUDIT_TEST_USER_ID ?? await getFallbackUserId(),
        primaryEntityId: getArgValue('entity-id') ?? process.env.AUDIT_TEST_ENTITY_ID ?? fallbackEntityIds.primaryEntityId,
        secondaryEntityId: getArgValue('entity-b-id') ?? process.env.AUDIT_TEST_ENTITY_B_ID ?? fallbackEntityIds.secondaryEntityId,
        concurrency: getConcurrency(),
    }
}

async function createTestRecord(params: {
    entityId: string
    userId: string
    batchId: string
    scenario: string
    index: number
}) {
    return await db
        .insertInto('audit_concurrency_test')
        .values({
            entity_id: params.entityId,
            user_id: params.userId,
            batch_id: params.batchId,
            scenario: params.scenario,
            sequence_no: params.index,
            metadata: {
                purpose: 'audit advisory lock concurrency test',
            },
        })
        .returning('id')
        .executeTakeFirstOrThrow()
}

async function appendTestLog(params: {
    entityId: string
    userId: string
    batchId: string
    scenario: string
    index: number
    recordId?: string
}) {
    const record = params.recordId
        ? { id: params.recordId }
        : await createTestRecord({
            entityId: params.entityId,
            userId: params.userId,
            batchId: params.batchId,
            scenario: params.scenario,
            index: params.index,
        })

    return await createLog({
        entity_id: params.entityId,
        user_id: params.userId,
        event_type: 'EDIT_FORM',
        table_name: 'audit_concurrency_test',
        record_id: record.id,
        payload: {
            batch_id: params.batchId,
            scenario: params.scenario,
            index: params.index,
            purpose: 'audit advisory lock concurrency test',
        },
        public_key_snapshot: null,
        signature: null,
    }, null)
}

async function runSameEntitySameRecordTest(context: TestContext, batchId: string) {
    const scenario = 'same_entity_same_record'
    const record = await createTestRecord({
        entityId: context.primaryEntityId,
        userId: context.userId,
        batchId,
        scenario,
        index: 0,
    })

    await Promise.all(
        Array.from({ length: context.concurrency }, (_, index) =>
            appendTestLog({
                entityId: context.primaryEntityId,
                userId: context.userId,
                batchId,
                scenario,
                index,
                recordId: record.id,
            })
        )
    )

    return await verifyEntityChain(context.primaryEntityId)
}

async function runSameEntityDifferentRecordTest(context: TestContext, batchId: string) {
    const scenario = 'same_entity_different_records'

    await Promise.all(
        Array.from({ length: context.concurrency }, (_, index) =>
            appendTestLog({
                entityId: context.primaryEntityId,
                userId: context.userId,
                batchId,
                scenario,
                index,
            })
        )
    )

    return await verifyEntityChain(context.primaryEntityId)
}

async function runDifferentEntityTest(context: TestContext, batchId: string) {
    const scenario = 'different_entities'

    await Promise.all([
        appendTestLog({
            entityId: context.primaryEntityId,
            userId: context.userId,
            batchId,
            scenario,
            index: 1,
        }),
        appendTestLog({
            entityId: context.secondaryEntityId,
            userId: context.userId,
            batchId,
            scenario,
            index: 2,
        }),
    ])

    const [primaryResult, secondaryResult] = await Promise.all([
        verifyEntityChain(context.primaryEntityId),
        verifyEntityChain(context.secondaryEntityId),
    ])

    return { primaryResult, secondaryResult }
}

function assertChainValid(name: string, result: ChainVerificationResult) {
    if (!result.isValid) {
        if (result.report) {
            console.error(`${name} chain failure report:`)
            console.error(JSON.stringify(result.report, null, 2))
        }

        throw new Error(`${name} failed: broken audit chain at ${result.brokenAt ?? 'unknown log'}.`)
    }
}

async function main() {
    const batchId = randomUUID()
    const context = await resolveContext(batchId)

    console.log('Audit concurrency test writes append-only audit logs.')
    console.log(`Using ${shouldUseExistingFixtures() ? 'existing fixtures' : 'fresh isolated fixtures'}.`)
    console.log(`Batch: ${batchId}`)
    console.log(`User: ${context.userId}`)
    console.log(`Primary entity: ${context.primaryEntityId}`)
    console.log(`Secondary entity: ${context.secondaryEntityId}`)
    console.log(`Concurrent appends per same-entity test: ${context.concurrency}`)

    const [initialPrimaryResult, initialSecondaryResult] = await Promise.all([
        verifyEntityChain(context.primaryEntityId),
        verifyEntityChain(context.secondaryEntityId),
    ])
    assertChainValid('Initial primary entity chain', initialPrimaryResult)
    assertChainValid('Initial secondary entity chain', initialSecondaryResult)

    const sameRecordResult = await runSameEntitySameRecordTest(context, `${batchId}-same-record`)
    assertChainValid('Same entity / same record', sameRecordResult)
    console.log('ok Same entity / same record chain stayed valid.')

    const differentRecordResult = await runSameEntityDifferentRecordTest(context, `${batchId}-different-records`)
    assertChainValid('Same entity / different records', differentRecordResult)
    console.log('ok Same entity / different records chain stayed valid.')

    const differentEntityResult = await runDifferentEntityTest(context, `${batchId}-different-entities`)
    assertChainValid('Different entity / primary', differentEntityResult.primaryResult)
    assertChainValid('Different entity / secondary', differentEntityResult.secondaryResult)
    console.log('ok Different entity chains stayed valid.')
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await db.destroy()
    })
