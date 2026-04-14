import { Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable('audit_logs')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('entity_id', 'uuid', (col) => col.references('entities.id').notNull())
        .addColumn('user_id', 'varchar', (col) => col.references('users.id').notNull())
        .addColumn('event_type', 'varchar', (col) => col.notNull())
        .addColumn('table_name', 'varchar')
        .addColumn('record_id', 'uuid')
        .addColumn('payload', 'jsonb')
        .addColumn('changed_at', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
        .addColumn('nonce', 'varchar')
        .addColumn('prev_hash', 'text')
        .addColumn('hash', 'text', (col) => col.notNull())
        .addColumn('public_key_snapshot', 'text')
        .addColumn('signature', 'text')
        .execute()

    await db.schema
        .createTable('merkle_roots')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('entity_id', 'uuid', (col) => col.references('entities.id').notNull())
        .addColumn('root_hash', 'text', (col) => col.notNull())
        .addColumn('log_count', 'integer', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
        .execute()

    // Create composite index for search queries
    await db.schema.createIndex('audit_logs_target_idx')
        .on('audit_logs')
        .columns(['table_name', 'record_id'])
        .execute()

    await db.schema.createIndex('idx_merkle_roots_entity_id_created_at')
        .on('merkle_roots')
        .columns(['entity_id', 'created_at'])
        .execute()

    // Create B-tree indexes
    await db.schema.createIndex('idx_audit_logs_entity_id')
        .on('audit_logs')
        .column('entity_id')
        .execute()

    await db.schema.createIndex('idx_audit_logs_changed_at')
        .on('audit_logs')
        .column('changed_at')
        .execute()

    // Create trigger to prevent form status rollback
    await sql`
        CREATE OR REPLACE FUNCTION prevent_approved_status_rollback()
        RETURNS TRIGGER AS $$
        BEGIN
            IF OLD.auth_status = 'approved' AND NEW.auth_status != 'approved' THEN
                RAISE EXCEPTION 'Cannot revert an approved form status.';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `.execute(db)

    await sql`
        CREATE TRIGGER trg_prevent_status_rollback
        BEFORE UPDATE ON forms
        FOR EACH ROW
        EXECUTE FUNCTION prevent_approved_status_rollback();
    `.execute(db)

    // Create trigger to make audit logs append-only
    await sql`
        CREATE OR REPLACE FUNCTION make_table_append_only()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Table is append-only. UPDATE/DELETE forbidden.';
        END;
        $$ LANGUAGE plpgsql;
    `.execute(db)

    await sql`
        CREATE TRIGGER trg_audit_logs_append_only
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH STATEMENT
        EXECUTE FUNCTION make_table_append_only();
    `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop triggers
    await sql`DROP TRIGGER IF EXISTS trg_prevent_status_rollback ON forms`.execute(db)
    await sql`DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs`.execute(db)

    // Drop indexes
    await db.schema.dropIndex('idx_audit_logs_entity_id').execute()
    await db.schema.dropIndex('idx_merkle_roots_entity_id_created_at').execute()
    await db.schema.dropIndex('audit_logs_target_idx').execute()
    await db.schema.dropIndex('idx_audit_logs_changed_at').execute()

    // Drop tables
    await db.schema.dropTable('audit_logs').execute()
    await db.schema.dropTable('merkle_roots').execute()
}