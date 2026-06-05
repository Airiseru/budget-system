import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable("cost_by_components")
        .addColumn("item_catalog_id", "uuid", (col) =>
            col.references("item_catalog.id"),
        )
        .addColumn("fund_code", "varchar", (col) =>
            col.references("uacs_funding_sources.code"),
        )
        .addColumn("specific_description", "text")
        .addColumn("currency", "varchar", (col) =>
            col.notNull().defaultTo("PHP"),
        )
        .addColumn("proposed_amt", "numeric(15, 2)", (col) =>
            col.notNull().defaultTo(0),
        )
        .addColumn("tier", "integer", (col) => col.notNull().defaultTo(2))
        .execute();

    await db.schema
        .createIndex("idx_cost_by_components_item_catalog_id")
        .on("cost_by_components")
        .column("item_catalog_id")
        .execute();

    await db.schema
        .createIndex("idx_cost_by_components_fund_code")
        .on("cost_by_components")
        .column("fund_code")
        .execute();

    await db.schema
        .alterTable("cost_by_components")
        .addCheckConstraint(
            "cost_by_components_tier_two_check",
            sql`tier = 2`,
        )
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .alterTable("cost_by_components")
        .dropConstraint("cost_by_components_tier_two_check")
        .execute();
    await db.schema
        .dropIndex("idx_cost_by_components_fund_code")
        .ifExists()
        .execute();
    await db.schema
        .dropIndex("idx_cost_by_components_item_catalog_id")
        .ifExists()
        .execute();
    await db.schema
        .alterTable("cost_by_components")
        .dropColumn("tier")
        .dropColumn("proposed_amt")
        .dropColumn("currency")
        .dropColumn("specific_description")
        .dropColumn("fund_code")
        .dropColumn("item_catalog_id")
        .execute();
}
