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


// export interface RetireesListTable {
//     id: Generated<string>
//     fiscal_year: number
//     is_mandatory: boolean
//     submission_date: Generated<Date>
//     created_at: Generated<Date>
//     updated_at: ColumnType<Date, never, Date>
// }


// export interface RetireeRecordTable {
//     id: Generated<string>
//     retirees_list_id: string // Foreign Key to RetireesListTable
//     name: string
//     is_gsis_member: boolean
//     retirement_law: string // e.g., RA 8291, RA 1616
//     position: string
//     salary_grade: number // Important for GAA validation
//     date_of_birth: Date
//     original_appointment: Date
//     retirement_effectivity: Date
//     highest_monthly_salary: number
//     // Leave Credits for Terminal Leave Pay (TLP) calculation
//     number_vacation_leave: number | null
//     number_sick_leave: number | null
//     total_credible_service: number | null
//     number_gratuity_months: number | null
// }

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