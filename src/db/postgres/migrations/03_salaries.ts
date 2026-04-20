import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
    // Salary Schedules
    await db.schema
        .createTable('salary_schedules')
        .addColumn('id', 'uuid', (col) => col.primaryKey().notNull().defaultTo(sql`gen_random_uuid()`))
        .addColumn('circular_reference', 'text', (col) => col.notNull())
        .addColumn('effective_date', 'date', (col) => col.notNull())
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Rates
    await db.schema
        .createTable('salary_rates')
        .addColumn('id', 'uuid', (col) => col.primaryKey().notNull().defaultTo(sql`gen_random_uuid()`))
        .addColumn('schedule_id', 'uuid', (col) => 
            col.references('salary_schedules.id').onDelete('cascade').notNull()
        )
        .addColumn('salary_grade', 'integer', (col) => col.notNull())
        .addColumn('step', 'integer', (col) => col.notNull())
        .addColumn('amount', 'numeric', (col) => col.notNull())
        
        // Ensure you can't have duplicate grade/step combos for a single schedule
        .addUniqueConstraint('unique_schedule_grade_step', ['schedule_id', 'salary_grade', 'step'])
        .execute()

    // Compensation Rules
    await db.schema
        .createTable('compensation_rules')
        .addColumn('id', 'uuid', (col) => col.primaryKey().notNull().defaultTo(sql`gen_random_uuid()`))
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('effective_date', 'date', (col) => col.notNull())
        .addColumn('calculation_type', 'text', (col) => col.notNull())
        .addColumn('frequency', 'text', (col) => col.notNull())
        .addCheckConstraint('valid_frequency', sql`frequency IN ('monthly', 'annual')`)
        .addColumn('rule_value', 'numeric', (col) => col.notNull())
        .addColumn('min_salary_grade', 'integer', (col) => col.defaultTo(1))
        .addColumn('max_salary_grade', 'integer', (col) => col.defaultTo(33))
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop tables
    await db.schema.dropTable('salary_schedules').execute()
    await db.schema.dropTable('salary_rates').execute()
    await db.schema.dropTable('compensation_rules').execute()
}