import { Kysely, sql } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable('item_catalog')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('uacs_obj_code', 'varchar', (col) => col.references('uacs_object_codes.code').notNull())
        
        // Scope and ownership of item
        // 'global' = all entities & any PAP, 'entity' = custom to entity, 'pap' = custom to specific PAP
        .addColumn('scope', 'varchar', (col) => col.notNull().defaultTo('global'))
        .addColumn('entity_id', 'uuid', (col) => col.references('entities.id')) // Null if global
        .addColumn('pap_code', 'uuid', (col) => col.references('paps.id')) // Null unless scope is 'pap'

        .addColumn('name', 'varchar', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('expense_class', 'varchar', (col) => col.notNull())
        .addColumn('expense_class_code', 'varchar(1)', (col) => col.notNull())
        .addColumn('unit_of_measure', 'varchar') // for procurement projects
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Create B-tree indexes
    await db.schema.createIndex('idx_item_catalog_entity_id').on('item_catalog').column('entity_id').execute()
    await db.schema.createIndex('idx_item_catalog_pap_code').on('item_catalog').column('pap_code').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropIndex('idx_item_catalog_entity_id').execute()
    await db.schema.dropIndex('idx_item_catalog_pap_code').execute()
    await db.schema.dropTable('item_catalog').execute()
}
