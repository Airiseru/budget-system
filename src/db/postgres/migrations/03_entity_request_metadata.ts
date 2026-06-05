import { Kysely, sql } from 'kysely'
import type { Database } from '@/src/types'

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable('entity_requests')
        .addColumn('proposed_abbr', 'varchar')
        .addColumn('proposed_agency_type', 'varchar')
        .addColumn('proposed_parent_department_id', 'uuid', (col) => col.references('departments.id'))
        .addColumn('proposed_parent_agency_id', 'uuid', (col) => col.references('agencies.id'))
        .addColumn('proposed_parent_ou_id', 'uuid', (col) => col.references('operating_units.id'))
        .execute()

    await sql`
        UPDATE entity_requests
        SET proposed_parent_department_id = requested_by_id
        WHERE requested_by_type = 'department' AND proposed_classification = 'agency'
    `.execute(db)

    await sql`
        UPDATE entity_requests
        SET proposed_parent_agency_id = requested_by_id
        WHERE requested_by_type = 'agency' AND proposed_classification = 'operating_unit'
    `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema
        .alterTable('entity_requests')
        .dropColumn('proposed_parent_ou_id')
        .dropColumn('proposed_parent_agency_id')
        .dropColumn('proposed_parent_department_id')
        .dropColumn('proposed_agency_type')
        .dropColumn('proposed_abbr')
        .execute()
}
