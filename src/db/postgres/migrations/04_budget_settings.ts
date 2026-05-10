import { Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('budget_cycles')
        .addColumn('fiscal_year', 'integer', (col) => col.primaryKey()) 
        
        // Preparation Phase (BP Forms, NEP formulation)
        .addColumn('prep_status', 'text', (col) => col.notNull().defaultTo('closed')) // 'closed', 'active', 'locked'
        .addColumn('current_phase', 'text', (col) => col.notNull().defaultTo('preparation'))
        
        // Audit logic
        .addColumn('prep_opened_at', 'timestamptz')
        .addColumn('prep_locked_at', 'timestamptz')
        .addColumn('status_changed_by', 'varchar', (col) => col.references('users.id'))

        // Legal basis
        .addColumn('legal_basis_ref', 'varchar')

        // Timestamps
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .execute()

    await sql`
        UPDATE budget_cycles
        SET current_phase = CASE
            WHEN prep_status = 'locked' THEN 'enacted_gaa'
            ELSE 'preparation'
        END
    `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('budget_cycles').execute()
}
