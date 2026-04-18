import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
    // Create the Parent Table (Staffing Summary)
    await db.schema
        .createTable('staffing_summaries')
        // ID is the Primary Key AND references forms.id
        .addColumn('id', 'uuid', (col) => 
            col.primaryKey().references('forms.id').onDelete('cascade')
        )
        .addColumn('fiscal_year', 'integer', (col) => col.notNull())
        .addColumn('submission_date', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create the Child Table (Positions)
    await db.schema
        .createTable('positions')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('staffing_summary_id', 'uuid', (col) => 
            col.references('staffing_summaries.id').onDelete('cascade').notNull()
        )
        .addColumn('pap_id', 'uuid', (col) => col.references('paps.id').notNull())
        .addColumn('tier', 'integer', (col) => col.notNull())
        .addColumn('staff_type', 'text', (col) => col.notNull())
        .addColumn('organizational_unit', 'text', (col) => col.notNull())
        .addColumn('position_title', 'text', (col) => col.notNull())
        .addColumn('salary_grade', 'integer', (col) => col.notNull())
        .addColumn('num_positions', 'integer', (col) => col.notNull())
        .addColumn('months_employed', 'integer', (col) => col.notNull())
        .addColumn('total_salary', 'numeric', (col) => col.notNull())
        .execute()

    // Compensations (Child of Positions)
    await db.schema
        .createTable('compensations')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('staff_id', 'uuid', (col) => 
            col.references('positions.id').onDelete('cascade').notNull()
        )
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('amount', 'numeric(12, 2)', (col) => col.notNull().defaultTo(0))
        .addCheckConstraint('valid_comp_names', 
            sql`name IN ('PERA', 'RATA', 'Clothing Allowance', 'Mid Year Bonus', 'End Year Bonus', 'Cash Gift', 'PEI', 'RLIP', 'Pag-IBIG', 'ECiP', 'PHIC')`
        )
        .execute()

    // Create B-tree index
    await db.schema.createIndex('idx_pap_id').on('positions').column('pap_id').execute()
    await db.schema.createIndex('idx_staffing_summary_id').on('positions').column('staffing_summary_id').execute()
    await db.schema.createIndex('idx_comp_staff_id').on('compensations').column('staff_id').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop indexes
    await db.schema.dropIndex('idx_pap_id').execute()
    await db.schema.dropIndex('idx_staffing_summary_id').execute()
    await db.schema.dropIndex('idx_comp_staff_id').execute()

    // Drop tables
	await db.schema.dropTable('compensations').execute()
    await db.schema.dropTable('positions').execute()
    await db.schema.dropTable('staffing_summaries').execute()
}