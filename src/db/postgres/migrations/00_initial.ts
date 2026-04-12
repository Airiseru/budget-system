import { Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
    // Create Entities Table
    await db.schema
        .createTable('entities')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('type', 'varchar', (col) => col.notNull())
        .execute()

    // Create User Table
    await db.schema
        .createTable("users")
        .addColumn('id', 'varchar', (col) => col.primaryKey().notNull())
        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('email', 'varchar', (col) => col.notNull())
        .addColumn('email_verified', 'boolean', (col) => col.notNull().defaultTo(false))
        .addColumn('position', 'varchar', (col) => col.notNull())
        .addColumn('role', 'varchar', (col) => col.notNull().defaultTo('unverified').check(sql`role IN ('unverified', 'admin', 'dbm', 'agency')`))
        .addColumn('workflow_role', 'varchar', (col) => col.check(sql`workflow_role IN ('personnel_officer', 'budget_officer', 'planning_officer', 'chief_accountant', 'office_head', 'agency_head')`))
        .addColumn('access_level', 'varchar', (col) => col.notNull().defaultTo('none'))
        .addColumn('signing_pin_hash', 'varchar(60)') // hashed pin for digital signatures
        .addColumn('entity_id', 'uuid', (col) => col.references('entities.id').onDelete('cascade').notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // create Forms table
    await db.schema
        .createTable('forms')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        // Link to the Entity submitting the form
        .addColumn('entity_id', 'uuid', (col) => col.references('entities.id').notNull())
        .addColumn('type', 'text', (col) => col.notNull()) // e.g., 'bp204', 'bp205'
        .addColumn('codename', 'text')
        .addColumn('auth_status', 'text', (col) => col.defaultTo('draft'))
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create User Key Table
    await db.schema
        .createTable("user_keys")
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('user_id', 'varchar', (col) => col.references('users.id').onDelete('cascade').notNull())
        .addColumn('public_key', 'varchar', (col) => col.notNull())
        .addColumn('device_name', 'varchar', (col) => col.notNull())
        .addColumn('status', "varchar", (col) => col.notNull().defaultTo('active'))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
        .addColumn('revoked_at', 'timestamptz')
        .execute()

    // Create Signatories Table
    await db.schema
        .createTable("signatories")
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('form_id', 'uuid', col => col.notNull().references('forms.id').onDelete('cascade'))
        .addColumn('user_id', 'varchar', (col) => col.references('users.id').onDelete('cascade').notNull())
        .addColumn('role', 'varchar', (col) => col.notNull())
        .addColumn('key_id', 'uuid', col => col.notNull().references('user_keys.id'))
        .addColumn('public_key_snapshot', 'text', col => col.notNull())
        .addColumn('signature', 'text', col => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create Sessions Table
    await db.schema
        .createTable('sessions')
        .addColumn('id', 'varchar', (col) => col.primaryKey().notNull())
        .addColumn('user_id', 'varchar', (col) => col.references('users.id').onDelete('cascade').notNull())
        .addColumn('token', 'varchar', (col) => col.notNull().unique())
        .addColumn('expires_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('ip_address', 'varchar')
        .addColumn('user_agent', 'varchar')
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create Accounts Table
    await db.schema
        .createTable('accounts')
        .addColumn('id', 'varchar', (col) => col.primaryKey().notNull())
        .addColumn('user_id', 'varchar', (col) => col.references('users.id').onDelete('cascade').notNull())
        .addColumn("account_id", "varchar", (col) => col.notNull())
        .addColumn("provider_id", "varchar", (col) => col.notNull())
        .addColumn('access_token', 'text')
        .addColumn('refresh_token', 'text')
        .addColumn('access_token_expires_at', 'timestamptz')
        .addColumn('refresh_token_expires_at', 'timestamptz')
        .addColumn('scope', 'varchar')
        .addColumn('id_token', 'text')
        .addColumn('password', 'text')
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .execute()
    
    // Create Verifications Table
    await db.schema
        .createTable("verifications")
        .addColumn('id', 'varchar', (col) => col.primaryKey().notNull())
        .addColumn("identifier", "varchar", (col) => col.notNull())
        .addColumn('value', 'varchar', (col) => col.notNull())
        .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
        .execute()

    // Create Departments Table
    await db.schema
        .createTable('departments')
        .addColumn('id', 'uuid', (col) =>
            col.references('entities.id').onDelete('cascade').primaryKey().notNull()
        )
        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('abbr', 'varchar', (col) => col.notNull())
        .addColumn('uacs_code', 'varchar', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    await db.schema
        .createTable('agencies')
        .addColumn('id', 'uuid', (col) =>
            col.references('entities.id').onDelete('cascade').primaryKey().notNull()
        )
        .addColumn('department_id', 'uuid', (col) => col.references('departments.id').onDelete('cascade'))
        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('abbr', 'varchar')
        .addColumn('type', 'varchar', (col) => col.notNull())
        .addColumn('uacs_code', 'varchar', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    await db.schema
        .createTable('operating_units')
        .addColumn('id', 'uuid', (col) =>
            col.references('entities.id').onDelete('cascade').primaryKey().notNull()
        )
        .addColumn('agency_id', 'uuid', (col) => col.references('agencies.id').onDelete('cascade').notNull())
        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('abbr', 'varchar')
        .addColumn('uacs_code', 'varchar', (col) => col.notNull())
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create B-tree indexes
    await db.schema.createIndex('idx_entities_id').on('entities').column('id').execute()
    await db.schema.createIndex('idx_forms_entity_id').on('forms').column('entity_id').execute()
    await db.schema.createIndex('idx_user_keys_user_id').on('user_keys').column('user_id').execute()
    await db.schema.createIndex('idx_user_keys_status').on('user_keys').column('status').execute()
    await db.schema.createIndex('idx_signatories_form_id').on('signatories').column('form_id').execute()
    await db.schema.createIndex('idx_sessions_token').on('sessions').column('token').execute()
    await db.schema.createIndex('idx_sessions_user_id').on('sessions').column('user_id').execute()
    await db.schema.createIndex('idx_accounts_user_id').on('accounts').column('user_id').execute()
    await db.schema.createIndex('idx_agencies_department_id').on('agencies').column('department_id').execute()
    await db.schema.createIndex('idx_operating_units_agency_id').on('operating_units').column('agency_id').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop indexes
    await db.schema.dropIndex('idx_entities_id').execute()
    await db.schema.dropIndex('idx_forms_entity_id').execute()
    await db.schema.dropIndex('idx_user_keys_user_id').execute()
    await db.schema.dropIndex('idx_user_keys_status').execute()
    await db.schema.dropIndex('idx_signatories_form_id').execute()
    await db.schema.dropIndex('idx_sessions_token').execute()
    await db.schema.dropIndex('idx_sessions_user_id').execute()
    await db.schema.dropIndex('idx_accounts_user_id').execute()
    await db.schema.dropIndex('idx_agencies_department_id').execute()
    await db.schema.dropIndex('idx_operating_units_agency_id').execute()

    // Drop tables
    await db.schema.dropTable('entities').execute()
    await db.schema.dropTable('users').execute()
    await db.schema.dropTable('user_keys').execute()
    await db.schema.dropTable('signatories').execute()
    await db.schema.dropTable('sessions').execute()
    await db.schema.dropTable('accounts').execute()
    await db.schema.dropTable('verifications').execute()
    await db.schema.dropIndex('idx_sessions_token').execute()
    await db.schema.dropIndex('idx_sessions_user_id').execute()
    await db.schema.dropIndex('idx_accounts_user_id').execute()
    await db.schema.dropTable('departments').execute()
    await db.schema.dropTable('agencies').execute()
    await db.schema.dropTable('operating_units').execute()
    await db.schema.dropTable('forms').execute()
}