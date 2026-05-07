import { Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('budget_allocations')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        
        // What, when & where of money
        .addColumn('entity_id', 'uuid', (col) => col.references('entities.id').notNull())
        .addColumn('budget_cycle_year', 'integer', (col) => col.references('budget_cycles.fiscal_year').notNull())
        .addColumn('pap_code', 'uuid', (col) => col.references('paps.id')) // if applicable to all entities, points to which entity general PAP (e.g., GAS, STO)
        .addColumn('fund_code', 'varchar', (col) => col.references('uacs_funding_sources.code'))
        
        // Reference to item
        .addColumn('item_catalog_id', 'uuid', (col) => col.references('item_catalog.id').notNull())
        .addColumn('tier', 'integer', (col) => col.notNull()) // 1 (Ongoing) or 2 (New/Expanded)
        .addColumn('specific_description', 'text')
        .addColumn('quantity', 'integer', (col) => col.notNull())
        
        // Money allocations
        .addColumn('currency', 'varchar', (col) => col.defaultTo('PHP').notNull())
        .addColumn('proposed_amt', 'numeric(15, 2)', (col) => col.notNull().defaultTo(0))
        .addColumn('dbm_rec_amt', 'numeric(15, 2)', (col) => col.notNull().defaultTo(0))
        .addColumn('nep_amt', 'numeric(15, 2)', (col) => col.notNull().defaultTo(0))
        .addColumn('gaa_amt', 'numeric(15, 2)', (col) => col.notNull().defaultTo(0))
        
        // Validity dates
        .addColumn('valid_from', 'date')
        .addColumn('valid_until', 'date')

        .addColumn('auth_status', 'varchar', (col) => col.notNull().defaultTo('draft')) // draft, proposed, dbm_approved, gaa_approved, rejected
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create Indexes
    await db.schema
        .createIndex('budget_allocations_idx')
        .on('budget_allocations')
        .columns(['entity_id', 'budget_cycle_year', 'pap_code', 'fund_code', 'item_catalog_id', 'tier'])
        .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropIndex('budget_allocations_idx').execute()
    await db.schema.dropTable('budget_allocations').execute()
}
