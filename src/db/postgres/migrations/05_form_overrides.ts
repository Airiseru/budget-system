import { Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('administrative_overrides')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        
        // Specification of the override
        .addColumn('target_table', 'varchar', (col) => col.notNull()) // e.g., 'forms', 'budget_allocations', 'disbursements'
        .addColumn('target_record_id', 'uuid', (col) => col.notNull())
        
        .addColumn('overridden_by', 'varchar', (col) => col.references('users.id').notNull())
        
        // Remarks for the override
        .addColumn('justification_remark', 'text', (col) => col.notNull()) // "Force-editing due to late Executive Order."
        .addColumn('legal_directive_ref', 'varchar') // Legal directive reference
        
        // Snapshots
        .addColumn('snapshot_before', 'jsonb', (col) => col.notNull()) 
        .addColumn('snapshot_after', 'jsonb', (col) => col.notNull())
        
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Index
    await db.schema.createIndex('idx_admin_overrides_target').on('administrative_overrides').columns(['target_table', 'target_record_id']).execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropIndex('idx_admin_overrides_target').execute()
    await db.schema.dropTable('administrative_overrides').execute()
}