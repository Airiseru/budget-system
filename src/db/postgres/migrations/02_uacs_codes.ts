import { Kysely, sql } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
    // Funding Source
    await db.schema
        .createTable('uacs_funding_sources')
        .addColumn('code', 'varchar(8)', (col) => col.primaryKey()) // Fully combined code
        .addColumn('description', 'text', (col) => col.notNull())
        
        // The Hierarchical Breakdown
        .addColumn('cluster_code', 'varchar(2)', (col) => col.notNull())
        .addColumn('cluster_desc', 'varchar')
        
        .addColumn('financing_code', 'varchar(1)', (col) => col.notNull())
        .addColumn('financing_desc', 'varchar')
        
        .addColumn('auth_code', 'varchar(2)', (col) => col.notNull())
        .addColumn('auth_desc', 'varchar')
        
        .addColumn('category_code', 'varchar(3)', (col) => col.notNull())
        .addColumn('category_desc', 'varchar')
        
        .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('active'))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Location
    await db.schema
        .createTable('uacs_locations')
        .addColumn('code', 'varchar(9)', (col) => col.primaryKey())
        .addColumn('description', 'text', (col) => col.notNull())
        
        // The Hierarchical Breakdown
        .addColumn('region_code', 'varchar(2)', (col) => col.notNull())
        .addColumn('region_desc', 'varchar')
        
        .addColumn('province_code', 'varchar(2)', (col) => col.notNull())
        .addColumn('province_desc', 'varchar')
        
        .addColumn('city_municipality_code', 'varchar(2)', (col) => col.notNull())
        .addColumn('city_municipality_desc', 'varchar')
        
        .addColumn('brgy_code', 'varchar(3)', (col) => col.notNull())
        .addColumn('brgy_desc', 'varchar')
        
        .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('active'))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()

    // Object Code
    await db.schema
        .createTable('uacs_object_codes')
        .addColumn('code', 'varchar(10)', (col) => col.primaryKey())
        .addColumn('description', 'text', (col) => col.notNull())
        
        // The Hierarchical Breakdown
        .addColumn('chart_account_code', 'varchar(8)', (col) => col.notNull())
        .addColumn('chart_account_desc', 'varchar')
        
        .addColumn('sub_object_code', 'varchar(2)', (col) => col.notNull())
        .addColumn('sub_object_desc', 'varchar')
        
        .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('active'))
        .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`now()`))
        .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable('uacs_funding_sources').execute()
    await db.schema.dropTable('uacs_locations').execute()
    await db.schema.dropTable('uacs_object_codes').execute()
}