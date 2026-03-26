import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Create Pap Table
    await db.schema
        .createTable('pap')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('entity_id', 'uuid', (col) => col.references('entities.id').onDelete('cascade').notNull())
        .addColumn('org_outcome_id', 'varchar', (col) => col.notNull())
        .addColumn('pip_code', 'varchar')
        .addColumn('category', 'varchar', (col) => col.defaultTo('local'))
        .addColumn('title', 'varchar', (col) => col.notNull())
        .addColumn('description', 'varchar', (col) => col.notNull())
        .addColumn('purpose', 'varchar', (col) => col.notNull())
        .addColumn('beneficiaries', 'varchar', (col) => col.notNull())
        .addColumn('project_type', 'varchar')
        .addColumn('uacs_pap_code', 'varchar')
        .addColumn('actual_start_date', 'date')
        .addColumn('project_status', 'varchar', (col) => col.defaultTo('draft'))
        .addColumn('auth_status', 'varchar')
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create B-tree index for entity_id
    await db.schema.createIndex('idx_pap_entity_id').on('pap').column('entity_id').execute()

    // Create GIN index for full text search on title, description, and purpose
    await sql`
        CREATE INDEX idx_pap_search ON pap USING GIN(
            to_tsvector('english',
                COALESCE(title, '') || ' ' ||
                COALESCE(description, '') || ' ' ||
                COALESCE(purpose, '')
            )
        );
    `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop indexes
    await sql`DROP INDEX IF EXISTS idx_pap_search`.execute(db)
    await db.schema.dropIndex('idx_pap_entity_id').execute()

    // Drop tables
    await db.schema.dropTable('pap').execute()
}