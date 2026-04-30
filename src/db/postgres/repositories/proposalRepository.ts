import { db } from "../database";
import {
    FullProjectProposal,
    NewProjectProposal,
} from "../../../types/project_proposals";
import { sql } from "kysely";
import { Transaction } from "kysely";
import { Database } from "@/src/types";

// --- HELPERS (STAY RELATIVELY THE SAME) ---

async function insertWithCostSource(
    trx: Transaction<Database>,
    tableName: keyof Database,
    proposalId: string,
    items: any[],
    type: string,
) {
    if (!items || items.length === 0) return;
    for (const item of items) {
        const source = await trx
            .insertInto("cost_sources")
            .values({ type })
            .returning("id")
            .executeTakeFirstOrThrow();
        const { costs, ...entityData } = item;
        await trx
            .insertInto(tableName as any)
            .values({
                ...entityData,
                proposal_id: proposalId,
                cost_source_id: source.id,
            })
            .execute();
        if (costs && costs.length > 0) {
            await trx
                .insertInto("cost_by_expense_class")
                .values(
                    costs.map((c: any) => ({
                        amount: c.amount,
                        expense_class: c.expense_class,
                        currency: c.currency || "PHP",
                        cost_source_id: source.id,
                    })),
                )
                .execute();
        }
    }
}

async function insertAttributions(
    trx: Transaction<Database>,
    proposalId: string,
    attributions: any[],
) {
    if (!attributions?.length) return;
    for (const attr of attributions) {
        const attribution = await trx
            .insertInto("local_financial_attributions")
            .values({
                proposal_id: proposalId,
                description: attr.description,
            })
            .returning("id")
            .executeTakeFirstOrThrow();

        for (const entry of attr.attribution_costs) {
            if (!entry.costs || entry.costs.length === 0) continue;
            const source = await trx
                .insertInto("cost_sources")
                .values({ type: "local_attribution" })
                .returning("id")
                .executeTakeFirstOrThrow();
            await trx
                .insertInto("attribution_costs")
                .values({
                    attribution_id: attribution.id,
                    year: entry.year,
                    tier: entry.tier,
                    cost_source_id: source.id,
                })
                .execute();
            await trx
                .insertInto("cost_by_expense_class")
                .values(
                    entry.costs.map((c: any) => ({
                        cost_source_id: source.id,
                        expense_class: c.expense_class,
                        amount: c.amount || 0,
                        currency: c.currency || "PHP",
                    })),
                )
                .execute();
        }
    }
}

// --- REFACTORED CORE LOGIC ---

async function createProjectProposalRecord(
    trx: Transaction<Database>,
    entityId: string,
    fiscal_year: number,
    proposalData: any,
    payload: any,
    authStatus: string,
    parent_form_id?: string,
    version?: number,
) {
    console.log(fiscal_year);
    // 1. Insert into Forms
    const form = await trx
        .insertInto("forms")
        .values({
            entity_id: entityId, // Potential Source of Error
            type:
                proposalData.type === "202"
                    ? proposalData.is_new
                        ? "BP Form 202 (New)"
                        : "BP Form 202 (Expanded)"
                    : proposalData.is_new
                      ? "BP Form 203 (New)"
                      : "BP Form 203 (Expanded)",
            codename: `BP Form ${proposalData.type}`,
            auth_status: authStatus,
            fiscal_year: fiscal_year, // Potential Source of Error
            parent_form_id: parent_form_id ?? null,
            version: version ?? 1,
        })
        .returning(["id", "fiscal_year"])
        .executeTakeFirstOrThrow();

    const calculatedTotal = payload.cost_by_components?.reduce(
        (acc: number, comp: any) => {
            return (
                acc +
                (comp.costs?.reduce(
                    (sum: number, c: any) => sum + Number(c.amount || 0),
                    0,
                ) || 0)
            );
        },
        0,
    );

    // 2. Insert into Project Proposals
    const project = await trx
        .insertInto("project_proposals")
        .values({
            id: form.id,
            title: proposalData.title,
            proposal_year: proposalData.proposal_year,
            priority_rank: proposalData.priority_rank,
            is_new: proposalData.is_new ?? true,
            is_infrastructure: proposalData.is_infrastructure ?? false,
            for_ict: proposalData.for_ict ?? false,
            myca_issuance: proposalData.myca_issuance,
            total_proposal_currency:
                proposalData.total_proposal_currency || "PHP",
            total_proposal_cost:
                calculatedTotal || proposalData.total_proposal_cost || 0,
            type: proposalData.type,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    // 3. Create PAP and Junction
    const newPap = await trx
        .insertInto("paps")
        .values({
            entity_id: entityId,
            title: proposalData.title,
            org_outcome_id: proposalData.org_outcome_id || "O-1",
            description: proposalData.description || "No description provided.",
            purpose: proposalData.purpose || "No purpose provided.",
            beneficiaries: proposalData.beneficiaries || "General Public",
            project_type: proposalData.is_infrastructure
                ? "infrastructure"
                : "non-infrastructure",
            project_status: "proposed",
            auth_status: authStatus,
            category: proposalData.type === "202" ? "local" : "foreign",
            tier: 1,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

    await trx
        .insertInto("form_paps")
        .values({ form_id: form.id, pap_id: newPap.id })
        .execute();

    // 4. Insert Prerequisites and Dynamic Cost Data
    if (payload.pap_prerequisites?.length) {
        await trx
            .insertInto("pap_prerequisites")
            .values(
                payload.pap_prerequisites.map((p: any) => ({
                    ...p,
                    proposal_id: form.id,
                })),
            )
            .execute();
    }

    await insertWithCostSource(
        trx,
        "cost_by_components",
        form.id,
        payload.cost_by_components,
        "component",
    );

    if (proposalData.type === "202") {
        await insertAttributions(
            trx,
            form.id,
            payload.local_financial_attributions,
        );
        await insertWithCostSource(
            trx,
            "local_infrastructure_requirements",
            form.id,
            payload.local_infrastructure_requirements,
            "infra",
        );
        await insertWithCostSource(
            trx,
            "local_locations",
            form.id,
            payload.local_locations,
            "location",
        );
        if (payload.local_physical_targets?.length) {
            await trx
                .insertInto("local_physical_targets")
                .values(
                    payload.local_physical_targets.map((p: any) => ({
                        ...p,
                        proposal_id: form.id,
                    })),
                )
                .execute();
        }
    } else {
        await insertWithCostSource(
            trx,
            "foreign_financial_targets",
            form.id,
            payload.foreign_financial_targets,
            "for_fin",
        );
    }

    return {
        formId: form.id,
        papId: newPap.id,
        createdAt: project.created_at,
        fiscal_year: form.fiscal_year,
    };
}

export async function createProjectProposal(
    entityId: string,
    fiscal_year: number,
    proposalData: any,
    payload: any,
    authStatus: string,
    parent_form_id?: string,
    version?: number,
) {
    return await db.transaction().execute(async (trx) => {
        return await createProjectProposalRecord(
            trx,
            entityId,
            fiscal_year,
            proposalData,
            payload,
            authStatus,
            parent_form_id,
            version,
        );
    });
}

async function updateProjectProposalRecord(
    trx: Transaction<Database>,
    proposalId: string,
    payload: any,
    authStatus?: string,
) {
    const { payload: p } = payload;

    // 1. Update Form
    await trx
        .updateTable("forms")
        .set({
            auth_status: authStatus ?? payload.auth_status,
            fiscal_year: p.fiscal_year,
            updated_at: new Date(),
        })
        .where("id", "=", proposalId)
        .execute();

    // 2. Wipe existing related data (Cascading Cleanup)
    await sql`
        DELETE FROM cost_sources 
        WHERE id IN (
            SELECT cost_source_id FROM cost_by_components WHERE proposal_id = ${proposalId}
            UNION SELECT cost_source_id FROM attribution_costs 
                WHERE attribution_id IN (SELECT id FROM local_financial_attributions WHERE proposal_id = ${proposalId})
            UNION SELECT cost_source_id FROM local_infrastructure_requirements WHERE proposal_id = ${proposalId}
            UNION SELECT cost_source_id FROM local_locations WHERE proposal_id = ${proposalId}
            UNION SELECT cost_source_id FROM foreign_financial_targets WHERE proposal_id = ${proposalId}
        )
    `.execute(trx);

    await trx
        .deleteFrom("local_financial_attributions")
        .where("proposal_id", "=", proposalId)
        .execute();

    const nonCostTables = [
        "pap_prerequisites",
        "local_physical_targets",
        "foreign_physical_targets",
    ] as const;
    for (const table of nonCostTables) {
        await trx
            .deleteFrom(table)
            .where("proposal_id", "=", proposalId)
            .execute();
    }

    // 3. Update main proposal row
    await trx
        .updateTable("project_proposals")
        .set({
            proposal_year: p.proposal_year,
            priority_rank: p.priority_rank,
            is_new: p.is_new,
            is_infrastructure: p.is_infrastructure,
            for_ict: p.for_ict,
            total_proposal_cost: p.total_proposal_cost,
            updated_at: new Date(),
        })
        .where("id", "=", proposalId)
        .execute();

    // 4. Re-insert arrays (reuse the logic from create)
    if (p.pap_prerequisites?.length) {
        await trx
            .insertInto("pap_prerequisites")
            .values(
                p.pap_prerequisites.map((i: any) => ({
                    ...i,
                    proposal_id: proposalId,
                })),
            )
            .execute();
    }

    await insertWithCostSource(
        trx,
        "cost_by_components",
        proposalId,
        p.cost_by_components,
        "component",
    );

    if (p.type === "202") {
        await insertAttributions(
            trx,
            proposalId,
            p.local_financial_attributions,
        );
        await insertWithCostSource(
            trx,
            "local_infrastructure_requirements",
            proposalId,
            p.local_infrastructure_requirements,
            "infra",
        );
        await insertWithCostSource(
            trx,
            "local_locations",
            proposalId,
            p.local_locations,
            "loc",
        );
        if (p.local_physical_targets?.length) {
            await trx
                .insertInto("local_physical_targets")
                .values(
                    p.local_physical_targets.map((i: any) => ({
                        ...i,
                        proposal_id: proposalId,
                    })),
                )
                .execute();
        }
    } else {
        await insertWithCostSource(
            trx,
            "foreign_financial_targets",
            proposalId,
            p.foreign_financial_targets,
            "for_fin",
        );
    }
}

export async function updateProjectProposal(proposalId: string, payload: any) {
    return await db.transaction().execute(async (trx) => {
        await updateProjectProposalRecord(trx, proposalId, payload);
        return { success: true };
    });
}

export async function createDbmProposalOverwrite(
    sourceFormId: string,
    payload: any,
    authStatus?: string,
) {
    return await db.transaction().execute(async (trx) => {
        const sourceForm = await trx
            .selectFrom("forms")
            .select([
                "id",
                "entity_id",
                "parent_form_id",
                "version",
                "auth_status",
                "fiscal_year",
            ])
            .where("id", "=", sourceFormId)
            .executeTakeFirstOrThrow();

        const parentFormId = sourceForm.parent_form_id ?? sourceForm.id;

        const existingOverwrite = await trx
            .selectFrom("forms")
            .select(["id"])
            .where("parent_form_id", "=", parentFormId)
            .executeTakeFirst();

        if (existingOverwrite) {
            await updateProjectProposalRecord(
                trx,
                existingOverwrite.id,
                payload,
                authStatus,
            );
            return { formId: existingOverwrite.id, created: false };
        }

        const created = await createProjectProposalRecord(
            trx,
            sourceForm.entity_id,
            payload.payload.fiscal_year ?? sourceForm.fiscal_year,
            payload.payload, // assuming proposalData is nested in payload or payload itself
            payload.payload,
            authStatus ?? "pending_dbm",
            parentFormId,
            (sourceForm.version ?? 1) + 1,
        );

        return { formId: created.formId, created: true };
    });
}

export async function deleteProjectProposal(id: string) {
    return await db
        .deleteFrom("forms")
        .where("id", "=", id)
        .where("auth_status", "=", "draft") // Matching retiree security logic
        .executeTakeFirst();
}

export async function getProjectProposalById(
    id: string,
): Promise<FullProjectProposal | null> {
    const project = await db
        .selectFrom("project_proposals")
        .innerJoin("forms", "forms.id", "project_proposals.id")
        .selectAll("project_proposals")
        .select("forms.auth_status as auth_status")
        .where("project_proposals.id", "=", id)
        .executeTakeFirst();

    if (!project) return null;

    const fetchWithCosts = async (tableName: any) => {
        const items = await db
            .selectFrom(tableName)
            .where("proposal_id", "=", id)
            .selectAll()
            .execute();
        return await Promise.all(
            items.map(async (item: any) => {
                const costs = await db
                    .selectFrom("cost_by_expense_class")
                    .where("cost_source_id", "=", item.cost_source_id)
                    .selectAll()
                    .execute();
                return { ...item, costs };
            }),
        );
    };

    const fetchAttributions = async () => {
        const attributions = await db
            .selectFrom("local_financial_attributions")
            .where("proposal_id", "=", id)
            .selectAll()
            .execute();

        return await Promise.all(
            attributions.map(async (attr) => {
                // Get all year/tier cost groups for this attribution
                const costGroups = await db
                    .selectFrom("attribution_costs")
                    .where("attribution_id", "=", attr.id)
                    .selectAll()
                    .execute();

                const costsWithDetails = await Promise.all(
                    costGroups.map(async (group) => {
                        const details = await db
                            .selectFrom("cost_by_expense_class")
                            .where("cost_source_id", "=", group.cost_source_id)
                            .selectAll()
                            .execute();
                        return { ...group, expense_classes: details };
                    }),
                );

                return { ...attr, attribution_costs: costsWithDetails };
            }),
        );
    };

    return {
        ...project,
        pap_prerequisites: await db
            .selectFrom("pap_prerequisites")
            .where("proposal_id", "=", id)
            .selectAll()
            .execute(),
        cost_by_components: await fetchWithCosts("cost_by_components"),
        local_financial_attributions: await fetchAttributions(),
        local_physical_targets: await db
            .selectFrom("local_physical_targets")
            .where("proposal_id", "=", id)
            .selectAll()
            .execute(),
        local_infrastructure_requirements: await fetchWithCosts(
            "local_infrastructure_requirements",
        ),
        local_locations: await fetchWithCosts("local_locations"),
        foreign_financial_targets: await fetchWithCosts(
            "foreign_financial_targets",
        ),
        foreign_physical_targets: await db
            .selectFrom("foreign_physical_targets")
            .where("proposal_id", "=", id)
            .selectAll()
            .execute(),
    } as any;
}

export async function getAllProposalSummaries(
    userId: string,
    entityType: string,
    entityId: string,
) {
    let query = db
        .selectFrom("project_proposals as pp")
        .innerJoin("forms as f", "f.id", "pp.id")
        .select([
            "pp.id",
            "f.entity_id",
            "f.codename", // e.g., "BP Form 202"
            "pp.proposal_year",
            "pp.priority_rank",
            "pp.type",
            "pp.total_proposal_cost",
            "pp.total_proposal_currency",
            "f.auth_status",
            "pp.submission_date",
            "pp.is_infrastructure",
        ]);

    // If an entityId is provided, filter the results (Security Gate)
    if (entityId) {
        query = query.where("f.entity_id", "=", entityId);
    }

    if (entityType !== "admin") {
        // Use the explicit table name in the where clause
        query = query.where("f.entity_id", "=", entityId);
    }

    return await query
        .orderBy("pp.proposal_year", "desc")
        .orderBy("pp.priority_rank", "asc")
        .execute();
}
