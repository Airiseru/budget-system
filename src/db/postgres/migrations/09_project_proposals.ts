import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("cost_sources")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("type", "text", (col) => col.notNull()) // e.g., 'local_location', 'component'
        .execute();

    await db.schema
        .createTable("cost_by_expense_class")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("cost_source_id", "uuid", (col) =>
            col.references("cost_sources.id").onDelete("cascade").notNull(),
        )
        .addColumn("expense_class", "text", (col) => col.notNull()) // PS, MOOE, CO, FINEX
        .addColumn("fund_category", "text") // LP, Grant, GOP
        .addColumn("fund_component", "text") // cash, non-cash
        .addColumn("fund_method", "text") // direct payment, etc.
        .addColumn("currency", "text", (col) => col.notNull())
        .addColumn("amount", "decimal", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("project_proposals")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().references("forms.id").onDelete("cascade"),
        )
        .addColumn("entity_id", "uuid", (col) => col.notNull())
        .addColumn("title", "text", (col) => col.notNull())
        .addColumn("proposal_year", "integer", (col) => col.notNull())
        .addColumn("priority_rank", "integer", (col) => col.notNull())
        .addColumn("is_new", "boolean", (col) => col.notNull())
        .addColumn("myca_issuance", "boolean")
        .addColumn("is_infrastructure", "boolean", (col) => col.notNull())
        .addColumn("for_ict", "boolean")
        .addColumn("total_proposal_currency", "text", (col) => col.notNull())
        .addColumn("total_proposal_cost", "decimal", (col) => col.notNull())
        .addColumn("type", "text", (col) => col.notNull()) // '202' or '203'
        .addColumn("submission_date", "timestamp", (col) =>
            col.defaultTo(sql`now()`),
        )
        .addColumn("created_at", "timestamp", (col) =>
            col.defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamp", (col) =>
            col.defaultTo(sql`now()`),
        )
        .addUniqueConstraint("unique_entity_rank", [
            "entity_id",
            "priority_rank",
        ])
        .execute();

    // PAP Prerequisites
    await db.schema
        .createTable("pap_prerequisites")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("proposal_id", "uuid", (col) =>
            col
                .references("project_proposals.id")
                .onDelete("cascade")
                .notNull(),
        )
        .addColumn("name", "text", (col) => col.notNull())
        .addColumn("type", "text", (col) => col.notNull())
        .addColumn("status", "text", (col) => col.notNull())
        .addColumn("remarks", "text")
        .execute();

    // Cost by Components
    await db.schema
        .createTable("cost_by_components")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("proposal_id", "uuid", (col) =>
            col
                .references("project_proposals.id")
                .onDelete("cascade")
                .notNull(),
        )
        .addColumn("component_name", "text", (col) => col.notNull())
        .addColumn("cost_source_id", "uuid", (col) =>
            col.references("cost_sources.id").onDelete("cascade").notNull(),
        )
        .execute();

    // Local Financial Attributions (BP 202)
    await db.schema
        .createTable("local_financial_attributions")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("proposal_id", "uuid", (col) =>
            col
                .references("project_proposals.id")
                .onDelete("cascade")
                .notNull(),
        )
        .addColumn("description", "text", (col) => col.notNull())
        .execute();

    await db.schema
        .createTable("attribution_costs")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("attribution_id", "uuid", (col) =>
            col
                .references("local_financial_attributions.id")
                .onDelete("cascade")
                .notNull(),
        )
        .addColumn("year", "integer", (col) => col.notNull())
        .addColumn("tier", "integer") // 1 or 2
        .addColumn("cost_source_id", "uuid", (col) =>
            col.references("cost_sources.id").onDelete("cascade").notNull(),
        )
        .execute();

    // Local Physical Targets
    await db.schema
        .createTable("local_physical_targets")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("proposal_id", "uuid", (col) =>
            col
                .references("project_proposals.id")
                .onDelete("cascade")
                .notNull(),
        )
        .addColumn("year", "integer", (col) => col.notNull())
        .addColumn("tier", "integer")
        .addColumn("target_description", "text", (col) => col.notNull())
        .execute();

    // Local Infrastructure Requirements
    await db.schema
        .createTable("local_infrastructure_requirements")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("proposal_id", "uuid", (col) =>
            col
                .references("project_proposals.id")
                .onDelete("cascade")
                .notNull(),
        )
        .addColumn("description", "text", (col) => col.notNull())
        .addColumn("year", "integer", (col) => col.notNull())
        .addColumn("total_amt", "decimal", (col) => col.notNull())
        .addColumn("cost_source_id", "uuid", (col) =>
            col.references("cost_sources.id").onDelete("cascade").notNull(),
        )
        .execute();

    // Local Locations
    await db.schema
        .createTable("local_locations")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("proposal_id", "uuid", (col) =>
            col
                .references("project_proposals.id")
                .onDelete("cascade")
                .notNull(),
        )
        .addColumn("location", "text", (col) => col.notNull())
        .addColumn("cost_source_id", "uuid", (col) =>
            col.references("cost_sources.id").onDelete("cascade").notNull(),
        )
        .execute();

    // Foreign Financial Targets (BP 203)
    await db.schema
        .createTable("foreign_financial_targets")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("proposal_id", "uuid", (col) =>
            col
                .references("project_proposals.id")
                .onDelete("cascade")
                .notNull(),
        )
        .addColumn("year", "integer", (col) => col.notNull())
        .addColumn("lp_imprest", "decimal", (col) => col.defaultTo(0))
        .addColumn("lp_direct", "decimal", (col) => col.defaultTo(0))
        .addColumn("grant_amt", "decimal", (col) => col.defaultTo(0))
        .addColumn("gop_counterpart", "decimal", (col) => col.defaultTo(0))
        .addColumn("total_amt", "numeric(20, 2)", (col) => col.notNull())
        .execute();

    // Foreign Physical Targets
    await db.schema
        .createTable("foreign_physical_targets")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("proposal_id", "uuid", (col) =>
            col
                .references("project_proposals.id")
                .onDelete("cascade")
                .notNull(),
        )
        .addColumn("name", "text", (col) => col.notNull())
        .addColumn("cost_source_id", "uuid", (col) =>
            col.references("cost_sources.id").onDelete("cascade").notNull(),
        )
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("cost_by_expense_class").ifExists().execute();
    await db.schema.dropTable("foreign_physical_targets").ifExists().execute();
    await db.schema.dropTable("foreign_financial_targets").ifExists().execute();
    await db.schema.dropTable("local_locations").ifExists().execute();
    await db.schema
        .dropTable("local_infrastructure_requirements")
        .ifExists()
        .execute();
    await db.schema.dropTable("local_physical_targets").ifExists().execute();
    await db.schema
        .dropTable("local_financial_attributions")
        .ifExists()
        .execute();
    await db.schema.dropTable("cost_by_components").ifExists().execute();
    await db.schema.dropTable("pap_prerequisites").ifExists().execute();
    await db.schema.dropTable("project_proposals").ifExists().execute();
    await db.schema.dropTable("cost_sources").ifExists().execute();
}
