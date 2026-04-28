import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable('retirees_list')
        // ID is the Primary Key AND references forms.id
        .addColumn('id', 'uuid', (col) => 
            col.primaryKey().references('forms.id').onDelete('cascade')
        )
        .addColumn('fiscal_year', 'integer', (col) => col.notNull())
        .addColumn('is_mandatory', 'boolean', (col) => col.notNull())
        .addColumn('submission_date', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create the Child Table (Retirees)
    await db.schema
        .createTable('retirees')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('retirees_list_id', 'uuid', (col) => 
            col.references('retirees_list.id').onDelete('cascade').notNull()
        )
        .addColumn('name', 'text', (col) => col.notNull())
        .addColumn('is_gsis_member', 'boolean', (col) => col.notNull())
        .addColumn('retirement_law', 'text', (col) => col.notNull())
        .addColumn('position', 'text', (col) => col.notNull())
        .addColumn('salary_grade', 'integer', (col) => col.notNull())
        .addColumn('date_of_birth', 'timestamp', (col) => col.notNull())
        .addColumn('original_appointment', 'timestamp', (col) => col.notNull())
        .addColumn('retirement_effectivity', 'timestamp', (col) => col.notNull())
        .addColumn('highest_monthly_salary', 'numeric', (col) => col.notNull())
        .addColumn('number_vacation_leave', 'decimal')
        .addColumn('number_sick_leave', 'integer')
        .addColumn('total_credible_service', 'decimal')
        .addColumn('number_gratuity_months', 'integer')
        .execute()

    // Create B-tree index
    await db.schema.createIndex('idx_retirees_list_id').on('retirees').column('retirees_list_id').execute()

}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop tables
    await db.schema.dropTable('retirees').execute()
    await db.schema.dropTable('retirees_list').execute()
}