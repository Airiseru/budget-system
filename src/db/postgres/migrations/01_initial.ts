import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Create Entities Table
    await db.schema
        .createTable('entities')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('type', 'varchar', col => col.notNull())
        .execute()

    // Create Departments Table
    await db.schema
        .createTable('departments')
        .addColumn('id', 'uuid', (col) =>
            col.references('entities.id').onDelete('cascade').primaryKey().notNull()
        )
        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('uacs_code', 'varchar', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('entities').execute()
    await db.schema.dropTable('departments').execute()
}