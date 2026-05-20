import { Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
    // Create Pap Table
    await db.schema
        .createTable('paps')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('entity_id', 'uuid', (col) => col.references('entities.id').onDelete('cascade'))
        .addColumn('org_outcome_id', 'varchar', (col) => col.notNull())
        .addColumn('pip_code', 'varchar')
        .addColumn('category', 'varchar', (col) => col.defaultTo('local'))
        .addColumn('title', 'varchar', (col) => col.notNull())
        .addColumn('description', 'varchar', (col) => col.notNull())
        .addColumn('purpose', 'varchar', (col) => col.notNull())
        .addColumn('beneficiaries', 'varchar', (col) => col.notNull())
        .addColumn('project_type', 'varchar', (col) => col.check(sql`
            project_type IS NULL OR project_type IN (
                'local',
                'foreign',
                'general_administration_and_support',
                'support_to_operations',
                'operations'
            )
        `))

        // PREXC_FPAP_ID (all 0s = not set)
        .addColumn('cost_structure_code', 'varchar(1)', (col) => col.defaultTo('0'))
        .addColumn('organizational_outcome_code', 'varchar(1)', (col) => col.defaultTo('0'))
        .addColumn('program_code', 'varchar(2)', (col) => col.defaultTo('00'))
        .addColumn('subprogram_code', 'varchar(2)', (col) => col.defaultTo('00'))
        .addColumn('identifier_code', 'varchar(1)', (col) => col.defaultTo('0'))
        .addColumn('project_title_code', 'varchar(5)', (col) => col.defaultTo('00000'))
        .addColumn('reserved_codes', 'varchar(3)', (col) => col.defaultTo('000'))

        .addColumn('actual_start_date', 'date')
        .addColumn('project_status', 'varchar', (col) => col.defaultTo('draft'))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create B-tree index for entity_id
    await db.schema.createIndex('idx_pap_entity_id').on('paps').column('entity_id').execute()

    await sql`
        CREATE UNIQUE INDEX idx_paps_unique_assigned_full_prexc_uacs_code
        ON paps (
            (
                COALESCE(cost_structure_code, '') ||
                COALESCE(organizational_outcome_code, '') ||
                COALESCE(program_code, '') ||
                COALESCE(subprogram_code, '') ||
                COALESCE(identifier_code, '') ||
                COALESCE(project_title_code, '') ||
                COALESCE(reserved_codes, '')
            )
        )
        WHERE (
            COALESCE(cost_structure_code, '') ||
            COALESCE(organizational_outcome_code, '') ||
            COALESCE(program_code, '') ||
            COALESCE(subprogram_code, '') ||
            COALESCE(identifier_code, '') ||
            COALESCE(project_title_code, '') ||
            COALESCE(reserved_codes, '')
        ) <> '000000000000000';
    `.execute(db)

    // Create GIN index for full text search on title, description, and purpose
    await sql`
        CREATE INDEX idx_pap_search ON paps USING GIN(
            to_tsvector('english',
                COALESCE(title, '') || ' ' ||
                COALESCE(description, '') || ' ' ||
                COALESCE(purpose, '')
            )
        );
    `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Drop indexes
    await sql`DROP INDEX IF EXISTS idx_pap_search`.execute(db)
    await sql`DROP INDEX IF EXISTS idx_paps_unique_assigned_full_prexc_uacs_code`.execute(db)
    await db.schema.dropIndex('idx_pap_entity_id').execute()

    // Drop tables
    await db.schema.dropTable('paps').execute()
}
