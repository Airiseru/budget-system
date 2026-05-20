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
        
        // Money allocations
        .addColumn('currency', 'varchar', (col) => col.defaultTo('PHP').notNull())
        .addColumn('proposed_amt', 'numeric(15, 2)', (col) => col.notNull().defaultTo(0))
        .addColumn('dbm_rec_amt', 'numeric(15, 2)', (col) => col.notNull().defaultTo(0))
        .addColumn('nep_amt', 'numeric(15, 2)', (col) => col.notNull().defaultTo(0))
        .addColumn('gaa_amt', 'numeric(15, 2)', (col) => col.notNull().defaultTo(0))
        .addColumn('prev_year_gaa_amt', 'numeric(15, 2)', (col) => col.notNull().defaultTo(0))

        // Classification
        .addColumn('release_classification', 'varchar', (col) => col.notNull().defaultTo('unclassified'))

        // Set origin of when allocation was made (e.g., entity_proposed, dbm_insertion, legislative_insertion)
        .addColumn('origin_tag', 'varchar', (col) => col.notNull().defaultTo('entity_proposed'))
        
        // Validity dates
        .addColumn('valid_from', 'date')
        .addColumn('valid_until', 'date')

        .addColumn('auth_status', 'varchar', (col) => col.notNull().defaultTo('draft')) // draft, proposed, dbm_approved, nep_approved, gaa_approved, rejected
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    await db.schema
        .createTable('allocation_workflow_logs')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('allocation_id', 'uuid', (col) => col.references('budget_allocations.id').notNull())
        
        // The Context of the remark (e.g., 'entity_proposal', 'dbm_review', 'dbm_appeal', 'presidential_review', 'congressional_bicam')
        .addColumn('workflow_stage', 'varchar', (col) => col.notNull())
        
        // The actual text/justification
        .addColumn('remarks', 'text', (col) => col.notNull())
        
        // Snapshot the amounts at the exact time the remark was made
        .addColumn('amt_before', 'numeric(15, 2)')
        .addColumn('amt_after', 'numeric(15, 2)')
        .addColumn('performed_by', 'varchar', (col) => col.references('users.id').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create Indexes
    await db.schema
        .createIndex('budget_allocations_idx')
        .on('budget_allocations')
        .columns(['entity_id', 'budget_cycle_year', 'pap_code', 'fund_code', 'item_catalog_id', 'tier'])
        .execute()

    await sql`
        CREATE UNIQUE INDEX budget_allocations_unique_line_item_key
        ON budget_allocations (
            budget_cycle_year,
            entity_id,
            COALESCE(pap_code::text, '__NULL__'),
            COALESCE(fund_code, '__NULL__'),
            item_catalog_id
        );
    `.execute(db)
    
    await db.schema.createIndex('idx_allocation_logs_id').on('allocation_workflow_logs').column('allocation_id').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropIndex('budget_allocations_idx').execute()
    await sql`
        DROP INDEX IF EXISTS budget_allocations_unique_line_item_key;
    `.execute(db)
    await db.schema.dropIndex('idx_allocation_logs_id').execute()
    await db.schema.dropTable('allocation_workflow_logs').execute()
    await db.schema.dropTable('budget_allocations').execute()
}
