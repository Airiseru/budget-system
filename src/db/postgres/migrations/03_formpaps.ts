import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Create Junction Table for Form-PAP relationship
    await db.schema
        .createTable('form_paps')
        .addColumn('form_id', 'uuid', (col) => 
            col.references('forms.id').onDelete('cascade').notNull()
        )
        .addColumn('pap_id', 'uuid', (col) => 
            col.references('pap.id').onDelete('cascade').notNull()
        )
        // Create a composite primary key to prevent duplicate links
        .addPrimaryKeyConstraint('form_paps_pk', ['form_id', 'pap_id'])
        .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop tables
    await db.schema.dropTable('form_paps').execute()
}