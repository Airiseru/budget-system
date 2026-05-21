import { Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('audit_concurrency_test')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('entity_id', 'uuid', (col) => col.references('entities.id').notNull())
        .addColumn('user_id', 'varchar', (col) => col.references('users.id').notNull())
        .addColumn('batch_id', 'varchar', (col) => col.notNull())
        .addColumn('scenario', 'varchar', (col) => col.notNull())
        .addColumn('sequence_no', 'integer', (col) => col.notNull())
        .addColumn('metadata', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
        .execute()

    await db.schema
        .createIndex('idx_audit_concurrency_test_entity_batch')
        .on('audit_concurrency_test')
        .columns(['entity_id', 'batch_id'])
        .execute()

    await db.schema
        .createIndex('idx_audit_concurrency_test_batch_scenario')
        .on('audit_concurrency_test')
        .columns(['batch_id', 'scenario'])
        .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .dropIndex('idx_audit_concurrency_test_batch_scenario')
        .ifExists()
        .execute()

    await db.schema
        .dropIndex('idx_audit_concurrency_test_entity_batch')
        .ifExists()
        .execute()

    await db.schema
        .dropTable('audit_concurrency_test')
        .ifExists()
        .execute()
}
