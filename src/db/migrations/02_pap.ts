import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable('pap')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('entity_id', 'varchar', (col) => col.notNull())
        .addColumn('org_outcome_id', 'varchar', (col) => col.notNull())
        .addColumn('pip_code', 'varchar')
        .addColumn('category', 'varchar')
        .addColumn('title', 'varchar', (col) => col.notNull())
        .addColumn('description', 'varchar')
        .addColumn('purpose', 'varchar', (col) => col.notNull())
        .addColumn('beneficiaries', 'varchar', (col) => col.notNull())
        .addColumn('project_type', 'varchar')
        .addColumn('uacs_pap_code', 'varchar')
        .addColumn('actual_start_date', 'date')
        .addColumn('project_status', 'varchar')
        .addColumn('auth_status', 'varchar')
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`).notNull())
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
        .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('pap').execute()
}