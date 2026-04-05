import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
    // Create the Parent Table (Staffing Summary)
    await db.schema
        .createTable('staffing_summaries')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('form_id', 'uuid', (col) => 
            col.references('forms.id').onDelete('cascade').notNull().unique()
        )
        .addColumn('fiscal_year', 'integer', (col) => col.notNull())
        .addColumn('digital_signature', 'text', (col) => col.notNull())
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
    .addColumn('salary_grade', 'text', (col) => col.notNull())
    .addColumn('num_positions', 'integer', (col) => col.notNull())
    .addColumn('months_employed', 'integer', (col) => col.notNull())
    .addColumn('total_salary', 'numeric', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable('positions').execute()
	await db.schema.dropTable('staffing_summaries').execute()
}