import { Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('homepage_announcements')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('title', 'varchar', (col) => col.notNull())
        .addColumn('body_markdown', 'text', (col) => col.notNull())
        .addColumn('category', 'varchar')
        .addColumn('publish_at', 'timestamptz')
        .addColumn('expires_at', 'timestamptz')
        .addColumn('status', 'varchar', (col) =>
            col.notNull().defaultTo('draft').check(sql`status IN ('draft', 'published', 'archived')`)
        )
        .addColumn('is_pinned', 'boolean', (col) => col.notNull().defaultTo(false))
        .addColumn('display_order', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('created_by', 'varchar', (col) => col.references('users.id'))
        .addColumn('updated_by', 'varchar', (col) => col.references('users.id'))
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .execute()

    await db.schema
        .createTable('homepage_faqs')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('question', 'varchar', (col) => col.notNull())
        .addColumn('answer_markdown', 'text', (col) => col.notNull())
        .addColumn('category', 'varchar')
        .addColumn('status', 'varchar', (col) =>
            col.notNull().defaultTo('draft').check(sql`status IN ('draft', 'published', 'archived')`)
        )
        .addColumn('display_order', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('created_by', 'varchar', (col) => col.references('users.id'))
        .addColumn('updated_by', 'varchar', (col) => col.references('users.id'))
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .execute()

    await db.schema
        .createIndex('idx_homepage_announcements_public')
        .on('homepage_announcements')
        .columns(['status', 'publish_at', 'expires_at', 'is_pinned', 'display_order'])
        .execute()

    await db.schema
        .createIndex('idx_homepage_faqs_public')
        .on('homepage_faqs')
        .columns(['status', 'display_order'])
        .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('homepage_faqs').execute()
    await db.schema.dropTable('homepage_announcements').execute()
}
