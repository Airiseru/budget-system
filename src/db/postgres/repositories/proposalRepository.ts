import { db } from "../database";
import { FullProjectProposal } from "../../../types/project_proposals";
import { sql } from "kysely";
import { Transaction } from "kysely";
import { Database } from "@/src/types";
import { getOperatingUnitDescendantIds } from "./entityRepository";

type ProposalExpenseClass = {
    amount: number | string;
    expense_class: "PS" | "MOOE" | "CO" | "FINEX";
    currency?: string;
    fund_category?: "LP" | "Grant" | "GOP" | null;
    fund_method?: "cash" | "non_cash" | "non-cash" | null;
};

type ProposalCostSourceItem = Record<string, unknown> & {
    costs?: ProposalExpenseClass[];
    component_name?: string;
    description?: string;
    location?: string;
    name?: string;
    year?: number | string;
    total_amt?: number | string;
    item_catalog_id?: string | null;
    fund_code?: string | null;
    fund_description?: string | null;
    specific_description?: string | null;
    currency?: string;
    proposed_amt?: number | string;
    tier?: 2;
};

type ProposalAttributionEntry = {
    year: number;
    tier: 1 | 2;
    costs: ProposalExpenseClass[];
};

type ProposalAttribution = {
    description: string;
    attribution_costs: ProposalAttributionEntry[];
};

type ProposalPrerequisitePayload = {
    name: string;
    type: string;
    status: string;
    remarks?: string | null;
};

type ProposalPhysicalTargetPayload = {
    year: number;
    tier: 1 | 2;
    target_description: string;
};

type ProposalForeignFinancialPayload = {
    year: number;
    lp_imprest: number;
    lp_direct: number;
    grant: number;
    gop: number;
};

type ProposalWritePayload = {
    title: string;
    proposal_year: number;
    priority_rank: number;
    description: string;
    org_outcome_id: string;
    purpose: string;
    beneficiaries: string;
    is_new: boolean;
    is_infrastructure: boolean;
    for_ict?: boolean | null;
    myca_issuance: boolean;
    total_proposal_currency?: string;
    total_proposal_cost: number;
    type: "202" | "203";
    pap_prerequisites?: ProposalPrerequisitePayload[];
    cost_by_components: ProposalCostSourceItem[];
    local_financial_attributions?: ProposalAttribution[];
    local_infrastructure_requirements?: ProposalCostSourceItem[];
    local_locations?: ProposalCostSourceItem[];
    local_physical_targets?: ProposalPhysicalTargetPayload[];
    foreign_financial_targets?: ProposalForeignFinancialPayload[];
    foreign_physical_targets?: Array<Record<string, unknown>>;
};

type CostSourceTableName =
    | "cost_by_components"
    | "local_infrastructure_requirements"
    | "local_locations"
    | "foreign_financial_targets"
    | "foreign_physical_targets";

const toNumber = (value: number | string | undefined, fallback = 0) =>
    value === undefined || value === "" ? fallback : Number(value);

const normalizeFundMethod = (method: ProposalExpenseClass["fund_method"]) =>
    method === "non_cash" ? "non-cash" : method;

async function assertProposalRankAvailable(
    trx: Transaction<Database>,
    entityId: string,
    proposalYear: number,
    priorityRank: number,
    rootFormId: string,
) {
    const conflictingProposal = await trx
        .selectFrom("project_proposals")
        .select("id")
        .where("entity_id", "=", entityId)
        .where("proposal_year", "=", proposalYear)
        .where("priority_rank", "=", priorityRank)
        .where("root_form_id", "!=", rootFormId)
        .executeTakeFirst();

    if (conflictingProposal) {
        throw new Error("unique_entity_rank");
    }
}

async function findPreviousYearGaaAmountWithExecutor(
    trx: Transaction<Database>,
    params: {
        fiscalYear: number;
        entityId: string;
        papId: string;
        fundCode: string | null;
        tier: 1 | 2;
        itemCatalogId: string;
    },
) {
    let query = trx
        .selectFrom("budget_allocations")
        .select("gaa_amt")
        .where("budget_cycle_year", "=", params.fiscalYear - 1)
        .where("entity_id", "=", params.entityId)
        .where("pap_code", "=", params.papId)
        .where("tier", "=", params.tier)
        .where("item_catalog_id", "=", params.itemCatalogId);

    query = params.fundCode
        ? query.where("fund_code", "=", params.fundCode)
        : query.where("fund_code", "is", null);

    const match = await query
        .orderBy("updated_at", "desc")
        .executeTakeFirst();

    return Number(match?.gaa_amt ?? 0);
}

async function syncProposedExistingPapAllocationsWithExecutor(
    trx: Transaction<Database>,
    params: {
        entityId: string;
        fiscalYear: number;
        papId: string;
        components: ProposalCostSourceItem[];
    },
) {
    const allocationInputs = new Map<
        string,
        {
            item_catalog_id: string;
            fund_code: string | null;
            specific_description: string | null;
            currency: string;
            proposed_amt: number;
        }
    >();

    for (const component of params.components) {
        if (!component.item_catalog_id) continue;

        const itemCatalogId = component.item_catalog_id;
        const fundCode = component.fund_code ?? null;
        const key = `${itemCatalogId}::${fundCode ?? ""}`;
        const current = allocationInputs.get(key);

        if (current) {
            current.proposed_amt += toNumber(component.proposed_amt);
            continue;
        }

        allocationInputs.set(key, {
            item_catalog_id: itemCatalogId,
            fund_code: fundCode,
            specific_description: component.specific_description ?? null,
            currency: component.currency ?? "PHP",
            proposed_amt: toNumber(component.proposed_amt),
        });
    }

    for (const allocation of allocationInputs.values()) {
        const prevYearGaaAmount = await findPreviousYearGaaAmountWithExecutor(trx, {
            fiscalYear: params.fiscalYear,
            entityId: params.entityId,
            papId: params.papId,
            fundCode: allocation.fund_code,
            tier: 2,
            itemCatalogId: allocation.item_catalog_id,
        });

        const existing = await trx
            .selectFrom("budget_allocations")
            .select("id")
            .where("budget_cycle_year", "=", params.fiscalYear)
            .where("entity_id", "=", params.entityId)
            .where("pap_code", "=", params.papId)
            .where("item_catalog_id", "=", allocation.item_catalog_id)
            .where((eb) =>
                allocation.fund_code
                    ? eb("fund_code", "=", allocation.fund_code)
                    : eb("fund_code", "is", null),
            )
            .executeTakeFirst();

        if (existing) {
            await trx
                .updateTable("budget_allocations")
                .set({
                    proposed_amt: allocation.proposed_amt,
                    prev_year_gaa_amt: prevYearGaaAmount,
                    currency: allocation.currency,
                    specific_description: allocation.specific_description,
                    auth_status: "proposed",
                    updated_at: sql`now()`,
                })
                .where("id", "=", existing.id)
                .where("auth_status", "in", ["draft", "proposed"])
                .execute();
            continue;
        }

        await trx
            .insertInto("budget_allocations")
            .values({
                entity_id: params.entityId,
                budget_cycle_year: params.fiscalYear,
                pap_code: params.papId,
                fund_code: allocation.fund_code,
                item_catalog_id: allocation.item_catalog_id,
                tier: 2,
                specific_description: allocation.specific_description,
                currency: allocation.currency,
                proposed_amt: allocation.proposed_amt,
                dbm_rec_amt: 0,
                nep_amt: 0,
                gaa_amt: 0,
                prev_year_gaa_amt: prevYearGaaAmount,
                release_classification: "unclassified",
                origin_tag: "agency_proposed",
                auth_status: "proposed",
            })
            .execute();
    }
}

async function insertCostSourceEntity(
    trx: Transaction<Database>,
    tableName: CostSourceTableName,
    proposalId: string,
    sourceId: string,
    item: ProposalCostSourceItem,
) {
    switch (tableName) {
        case "cost_by_components":
            await trx
                .insertInto("cost_by_components")
                .values({
                    proposal_id: proposalId,
                    cost_source_id: sourceId,
                    component_name: item.component_name ?? "",
                    item_catalog_id: item.item_catalog_id ?? null,
                    fund_code: item.fund_code ?? null,
                    specific_description: item.specific_description ?? null,
                    currency: item.currency ?? "PHP",
                    proposed_amt: toNumber(item.proposed_amt),
                    tier: item.tier ?? 2,
                })
                .execute();
            return;
        case "local_infrastructure_requirements":
            await trx
                .insertInto("local_infrastructure_requirements")
                .values({
                    proposal_id: proposalId,
                    cost_source_id: sourceId,
                    description: item.description ?? "",
                    year: toNumber(item.year),
                    total_amt: toNumber(item.total_amt),
                })
                .execute();
            return;
        case "local_locations":
            await trx
                .insertInto("local_locations")
                .values({
                    proposal_id: proposalId,
                    cost_source_id: sourceId,
                    location: item.location ?? "",
                })
                .execute();
            return;
        case "foreign_physical_targets":
            await trx
                .insertInto("foreign_physical_targets")
                .values({
                    proposal_id: proposalId,
                    cost_source_id: sourceId,
                    name: item.name ?? "",
                })
                .execute();
            return;
        default:
            throw new Error(`Unsupported cost source table: ${tableName}`);
    }
}

export type DbmProposalComponent = {
    id: string;
    component_name: string;
    item_catalog_id: string | null;
    fund_code: string | null;
    fund_description: string | null;
    specific_description: string | null;
    currency: string;
    proposed_amt: number;
    expense_class: string | null;
    item_name: string | null;
};

export type DbmProposalReviewRow = {
    id: string;
    entity_id: string;
    title: string;
    proposal_year: number;
    priority_rank: number;
    type: "202" | "203";
    total_proposal_currency: string;
    total_proposal_cost: number;
    auth_status: string | null;
    updated_at: Date;
    department_id: string | null;
    department_name: string | null;
    agency_id: string | null;
    agency_name: string | null;
    operating_unit_id: string | null;
    operating_unit_name: string | null;
    entity_name: string | null;
    components: DbmProposalComponent[];
};

type DbmProposalReviewBaseRow = Omit<DbmProposalReviewRow, "components"> & {
    parent_form_id: string | null;
    version: number;
};

export type DbmProposalReviewFilters = {
    fiscalYear?: number;
    status?: string;
    departmentId?: string;
    agencyId?: string;
    operatingUnitId?: string;
    search?: string;
    limit?: number;
    offset?: number;
};

/**
 * Helper to handle the "Cost Source" architecture.
 * This separates the Entity (Component/Location) from its specific Expense Classes (PS, MOOE, etc.)
 */
async function insertWithCostSource(
    trx: Transaction<Database>,
    tableName: CostSourceTableName,
    proposalId: string,
    items: ProposalCostSourceItem[],
    type: string,
) {
    if (!items || items.length === 0) return;

    for (const item of items) {
        // 1. Create a tracking ID for the cost group
        const source = await trx
            .insertInto("cost_sources")
            .values({ type })
            .returning("id")
            .executeTakeFirstOrThrow();

        // 2. Separate costs array from the entity metadata (like component_name or location)
        const costs = item.costs;

        // 3. Insert the entity (e.g., the Component Row)
        await insertCostSourceEntity(
            trx,
            tableName,
            proposalId,
            source.id,
            item,
        );

        // 4. Insert the nested expense classes (PS, MOOE, CO, FE)
        if (costs && costs.length > 0) {
            await trx
                .insertInto("cost_by_expense_class")
                .values(
                    costs.map((c: ProposalExpenseClass) => ({
                        amount: Number(c.amount),
                        expense_class: c.expense_class,
                        currency: c.currency || "PHP",
                        cost_source_id: source.id,
                        fund_category: c.fund_category || null,
                        fund_method: normalizeFundMethod(c.fund_method) || null,
                    })),
                )
                .execute();
        }
    }
}

async function insertAttributions(
    trx: Transaction<Database>,
    proposalId: string,
    attributions: ProposalAttribution[],
) {
    if (!attributions?.length) return;

    for (const attr of attributions) {
        // 1. Insert the parent Attribution Description
        const attribution = await trx
            .insertInto("local_financial_attributions")
            .values({
                proposal_id: proposalId,
                description: attr.description,
            })
            .returning("id")
            .executeTakeFirstOrThrow();

        // 2. Loop through each Year/Tier (e.g., 2027 Tier 1, 2027 Tier 2)
        for (const entry of attr.attribution_costs) {
            if (!entry.costs || entry.costs.length === 0) continue;

            // 3. Create a unique cost_source for this specific Year + Tier
            const source = await trx
                .insertInto("cost_sources")
                .values({ type: "local_attribution" })
                .returning("id")
                .executeTakeFirstOrThrow();

            // 4. Link the Year/Tier to the Attribution and the Cost Source
            await trx
                .insertInto("attribution_costs")
                .values({
                    attribution_id: attribution.id,
                    year: entry.year,
                    tier: entry.tier,
                    cost_source_id: source.id,
                })
                .execute();

            // 5. Insert the actual money values (PS, MOOE, etc.)
            await trx
                .insertInto("cost_by_expense_class")
                .values(
                    entry.costs.map((c: ProposalExpenseClass) => ({
                        cost_source_id: source.id,
                        expense_class: c.expense_class,
                        amount: Number(c.amount || 0),
                        currency: c.currency || "PHP",
                        // fund_category, fund_component, etc. if provided
                    })),
                )
                .execute();
        }
    }
}

async function updateLinkedPapTitleForProposal(
    trx: Transaction<Database>,
    proposalId: string,
    title: string,
) {
    const linkedPaps = await trx
        .selectFrom("form_paps")
        .select("pap_id")
        .where("form_id", "=", proposalId)
        .execute();

    if (linkedPaps.length === 0) return;

    await trx
        .updateTable("paps")
        .set({
            title,
            updated_at: sql`now()`,
        })
        .where(
            "id",
            "in",
            linkedPaps.map((row) => row.pap_id),
        )
        .execute();
}

export async function createProjectProposal(
    entityId: string,
    payload: ProposalWritePayload,
    authStatus: string,
    fiscal_year: number,
    parent_form_id?: string,
    version?: number,
    existingPapId?: string,
) {
    return await db.transaction().execute(async (trx) => {
        // 1. Insert into Master Forms table
        const form = await trx
            .insertInto("forms")
            .values({
                entity_id: entityId,
                type:
                    payload.type === "202"
                        ? payload.is_new
                            ? "bp_local_proposal_new"
                            : "bp_local_proposal_expanded"
                        : payload.is_new
                          ? "bp_foreign_proposal_new"
                          : "bp_foreign_proposal_expanded",
                codename: `BP Form ${payload.type}`,
                auth_status: authStatus,
                fiscal_year: fiscal_year,
                parent_form_id: parent_form_id ?? null,
                version: version ?? 1,
            })
            .returning("id")
            .executeTakeFirstOrThrow();
        const rootFormId = parent_form_id ?? form.id;

        await assertProposalRankAvailable(
            trx,
            entityId,
            payload.proposal_year,
            payload.priority_rank,
            rootFormId,
        );

        // 2. Insert into Project Proposals
        const project = await trx
            .insertInto("project_proposals")
            .values({
                id: form.id,
                parent_form_id: parent_form_id ?? null,
                root_form_id: rootFormId,
                entity_id: entityId,
                title: payload.title,
                proposal_year: payload.proposal_year,
                priority_rank: payload.priority_rank,
                description: payload.description,
                org_outcome_id: payload.org_outcome_id,
                purpose: payload.purpose,
                beneficiaries: payload.beneficiaries,
                is_new: payload.is_new ?? true,
                is_infrastructure: payload.is_infrastructure ?? false,
                for_ict: payload.for_ict ?? false,
                myca_issuance: payload.myca_issuance,
                total_proposal_currency:
                    payload.total_proposal_currency || "PHP",
                total_proposal_cost: payload.total_proposal_cost || 0,
                type: payload.type,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        const targetDeptSubquery = trx
            .selectFrom("entities as e2")
            .leftJoin("agencies as a", "a.id", "e2.id")
            .leftJoin("operating_units as ou", "ou.id", "e2.id")
            .select(sql`COALESCE(a.department_id, ou.agency_id)`.as("dept_id"))
            .where("e2.id", "=", entityId)
            .limit(1);

        // Lock matching rows first, then compute max rank in JS.
        // PostgreSQL does not allow FOR UPDATE on aggregate queries.
        const departmentRankRows = await trx
            .selectFrom("project_proposals as pp")
            .innerJoin("forms as f", "f.id", "pp.id")
            .innerJoin("entities as e", "e.id", "f.entity_id")
            .leftJoin("agencies", "agencies.id", "e.id")
            .leftJoin("operating_units as ou", "ou.id", "e.id")
            .select("pp.dept_priority_rank")
            .where("pp.proposal_year", "=", payload.proposal_year)
            .where(
                sql`COALESCE(agencies.department_id, ou.agency_id)`,
                "=",
                targetDeptSubquery,
            )
            // CRITICAL: lock only proposal rows; left-joined entity subtype rows are nullable.
            .forUpdate("pp")
            .execute();

        const nextDeptRank =
            Math.max(
                0,
                ...departmentRankRows.map((row) =>
                    Number(row.dept_priority_rank ?? 0),
                ),
            ) + 1;

        // Apply calculated priority rank safely
        await trx
            .updateTable("project_proposals")
            .set({ dept_priority_rank: nextDeptRank })
            .where("id", "=", form.id)
            .execute();

        // 3. Original proposals create a PAP. Versioned overwrites reuse the family PAP by default.
        let papId = existingPapId;

        if (!papId && parent_form_id) {
            const familyPap = await trx
                .selectFrom("form_paps")
                .select("pap_id")
                .where("form_id", "=", parent_form_id)
                .executeTakeFirstOrThrow();

            papId = familyPap.pap_id;
        }

        if (!papId) {
            const newPap = await trx
                .insertInto("paps")
                .values({
                    entity_id: entityId,
                    title: payload.title,
                    // These columns are NOT NULL in your schema,
                    // so ensure they exist in proposalData or use defaults:
                    org_outcome_id: payload.org_outcome_id || "O-1",
                    description:
                        payload.description || "No description provided.",
                    purpose: payload.purpose || "No purpose provided.",
                    beneficiaries: payload.beneficiaries || "General Public",

                    project_type: getPapProjectTypeFromProposalType(payload.type),
                    project_status: "proposed",
                    category: payload.type === "202" ? "local" : "foreign",
                    identifier_code: payload.type === "202" ? "2" : "3",
                })
                .returning("id")
                .executeTakeFirstOrThrow();

            papId = newPap.id;
        }

        // 4. Link Form and PAP in the junction table
        await trx
            .insertInto("form_paps")
            .values({
                form_id: form.id,
                pap_id: papId,
            })
            .execute();

        // 5. Insert PAP Prerequisites
        if (payload.pap_prerequisites?.length) {
            await trx
                .insertInto("pap_prerequisites")
                .values(
                    payload.pap_prerequisites.map((p) => ({
                        ...p,
                        proposal_id: form.id,
                    })),
                )
                .execute();
        }

        // 6. Insert Costs & Other arrays (Simplified for brevity)
        await insertWithCostSource(
            trx,
            "cost_by_components",
            form.id,
            payload.cost_by_components,
            "component",
        );

        if (authStatus !== "draft" && !payload.is_new && papId) {
            await syncProposedExistingPapAllocationsWithExecutor(trx, {
                entityId,
                fiscalYear: payload.proposal_year,
                papId,
                components: payload.cost_by_components,
            });
        }

        if (payload.type === "202") {
            if (payload.local_financial_attributions?.length) {
                await insertAttributions(
                    trx,
                    form.id,
                    payload.local_financial_attributions,
                );
            }
            if (payload.local_infrastructure_requirements?.length) {
                await insertWithCostSource(
                    trx,
                    "local_infrastructure_requirements",
                    form.id,
                    payload.local_infrastructure_requirements,
                    "infra",
                );
            }
            if (payload.local_locations?.length) {
                await insertWithCostSource(
                    trx,
                    "local_locations",
                    form.id,
                    payload.local_locations,
                    "location",
                );
            }

            if (payload.local_physical_targets?.length) {
                await trx
                    .insertInto("local_physical_targets")
                    .values(
                        payload.local_physical_targets.map((p) => ({
                            ...p,
                            proposal_id: form.id,
                        })),
                    )
                    .execute();
            }
        } else {
            if (payload.foreign_financial_targets?.length) {
                await trx
                    .insertInto("foreign_financial_targets")
                    .values(
                        payload.foreign_financial_targets.map((p) => ({
                            ...p,
                            proposal_id: form.id,
                        })),
                    )
                    .execute();
            }
            if (payload.foreign_physical_targets?.length) {
                await insertWithCostSource(
                    trx,
                    "foreign_physical_targets",
                    form.id,
                    payload.foreign_physical_targets,
                    "foreign_physical_targets",
                );
            }
        }

        return {
            formId: form.id,
            papId,
            createdAt: project.created_at,
        };
    });
}

export async function getProjectProposalById(
    id: string,
): Promise<FullProjectProposal | null> {
    const project = await db
        .selectFrom("project_proposals")
        .innerJoin("forms", "forms.id", "project_proposals.id")
        .leftJoin("form_paps", "form_paps.form_id", "project_proposals.id")
        .selectAll("project_proposals")
        .select([
            "forms.auth_status as auth_status",
            "forms.parent_form_id as parent_form_id",
            "forms.version as version",
            "form_paps.pap_id as pap_id",
        ])
        .where("project_proposals.id", "=", id)
        .executeTakeFirst();

    if (!project) return null;

    const fetchWithCosts = async (tableName: CostSourceTableName) => {
        const items =
            tableName === "cost_by_components"
                ? await db
                      .selectFrom("cost_by_components")
                      .leftJoin(
                          "uacs_funding_sources",
                          "uacs_funding_sources.code",
                          "cost_by_components.fund_code",
                      )
                      .where("cost_by_components.proposal_id", "=", id)
                      .selectAll("cost_by_components")
                      .select(
                          "uacs_funding_sources.description as fund_description",
                      )
                      .execute()
                : await db
                      .selectFrom(tableName)
                      .where("proposal_id", "=", id)
                      .selectAll()
                      .execute();
        return await Promise.all(
            items.map(async (item) => {
                const costs = await db
                    .selectFrom("cost_by_expense_class")
                    .where("cost_source_id", "=", String(item.cost_source_id))
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
                // 1. Get all year/tier cost groups for this attribution
                const costGroups = await db
                    .selectFrom("attribution_costs")
                    .where("attribution_id", "=", attr.id)
                    .selectAll()
                    .execute();

                const attributionCosts = await Promise.all(
                    costGroups.map(async (group) => {
                        // 2. Fetch the actual PS, MOOE, etc. for this specific group
                        const details = await db
                            .selectFrom("cost_by_expense_class")
                            .where("cost_source_id", "=", group.cost_source_id)
                            .selectAll()
                            .execute();

                        // Return the group with the 'costs' key inside it
                        return {
                            year: group.year,
                            tier: group.tier,
                            costs: details,
                        };
                    }),
                );

                // 3. Map back to the parent object using the correct key: attribution_costs
                return {
                    ...attr,
                    attribution_costs: attributionCosts,
                };
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
        foreign_financial_targets: await db
            .selectFrom("foreign_financial_targets")
            .where("proposal_id", "=", id)
            .selectAll()
            .execute(),
        foreign_physical_targets: await fetchWithCosts(
            "foreign_physical_targets",
        ),
    } as unknown as FullProjectProposal;
}

export async function getAllProposalSummaries(
    entityType: string,
    userRole: string,
    entityId: string,
    fiscalYear?: number,
) {
    console.log("Fetching proposal summaries for:", {
        entityType,
        userRole,
        entityId,
        fiscalYear,
    });
    let query = db
        .selectFrom("project_proposals as pp")
        .innerJoin("forms as f", "f.id", "pp.id")
        .innerJoin("entities", "entities.id", "f.entity_id")
        .select([
            "pp.id",
            "f.entity_id",
            "f.parent_form_id",
            "f.version",
            "f.codename", // e.g., "BP Form 202"
            "pp.proposal_year",
            "pp.priority_rank",
            "pp.dept_priority_rank",
            "pp.type",
            "pp.total_proposal_cost",
            "pp.total_proposal_currency",
            "f.auth_status",
            "pp.submission_date",
            "pp.is_infrastructure",
            "pp.title",
            "entities.type as entity_type",
        ])
        .orderBy("pp.submission_date", "desc")
        .orderBy("pp.priority_rank", "asc");

    if (fiscalYear) {
        query = query.where("pp.proposal_year", "=", fiscalYear);
    }

    if (userRole === "national") {
        const rows = await query
            .orderBy("pp.proposal_year", "desc")
            .orderBy("pp.priority_rank", "asc")
            .execute();
        return getLatestProposalSummariesByFamily(rows);
    }

    if (userRole === "department") {
        const rows = await query
            .leftJoin("agencies", "agencies.id", "f.entity_id")
            .leftJoin("operating_units", "operating_units.id", "f.entity_id")
            .where(({ eb, or }) =>
                or([
                    eb("f.entity_id", "=", entityId),
                    eb("agencies.department_id", "=", entityId),
                    eb(
                        "operating_units.agency_id",
                        "in",
                        db
                            .selectFrom("agencies")
                            .where("department_id", "=", entityId)
                            .select("id"),
                    ),
                ]),
            )
            .execute();
        return getLatestProposalSummariesByFamily(rows);
    }

    if (userRole === "agency") {
        const rows = await query
            .leftJoin("operating_units", "operating_units.id", "f.entity_id")
            .where(({ eb, or }) =>
                or([
                    eb("f.entity_id", "=", entityId),
                    eb("operating_units.agency_id", "=", entityId),
                ]),
            )
            .execute();
        return getLatestProposalSummariesByFamily(rows);
    }

    if (userRole === "ou") {
        const descendantOuIds = await getOperatingUnitDescendantIds(entityId);
        const rows = await query
            .where("f.entity_id", "in", [entityId, ...descendantOuIds])
            .orderBy("pp.proposal_year", "desc")
            .orderBy("pp.priority_rank", "asc")
            .execute();
        return getLatestProposalSummariesByFamily(rows);
    }

    const rows = await query
        .where("f.entity_id", "=", entityId)
        .orderBy("pp.proposal_year", "desc")
        .orderBy("pp.priority_rank", "asc")
        .execute();
    return getLatestProposalSummariesByFamily(rows);
}

function getLatestProposalSummariesByFamily<
    T extends {
        id: string;
        parent_form_id: string | null;
        version: number;
        proposal_year: number;
        priority_rank: number;
    },
>(rows: T[]) {
    const latestByFamily = new Map<string, T>();

    for (const row of rows) {
        const familyId = row.parent_form_id ?? row.id;
        const current = latestByFamily.get(familyId);

        if (!current || row.version > current.version) {
            latestByFamily.set(familyId, row);
        }
    }

    return Array.from(latestByFamily.values()).sort((a, b) => {
        if (b.proposal_year !== a.proposal_year) {
            return b.proposal_year - a.proposal_year;
        }

        return a.priority_rank - b.priority_rank;
    });
}

function getComponentAllocationKey(component: {
    item_catalog_id: string | null;
    fund_code: string | null;
    specific_description: string | null;
}) {
    return [
        component.item_catalog_id ?? "",
        component.fund_code ?? "",
        component.specific_description ?? "",
    ].join("::");
}

function getPapProjectTypeFromProposalType(type: "202" | "203") {
    return type === "202" ? "local" : "foreign";
}

export async function createAllocationsForApprovedProposalWithExecutor(
    trx: Transaction<Database>,
    approvedFormId: string,
    performedBy: string,
) {
    const approvedForm = await trx
        .selectFrom("forms")
        .select(["id", "entity_id", "parent_form_id"])
        .where("id", "=", approvedFormId)
        .executeTakeFirstOrThrow();
    const proposal = await trx
        .selectFrom("project_proposals")
        .select([
            "proposal_year",
            "description",
            "org_outcome_id",
            "purpose",
            "beneficiaries",
            "type",
        ])
        .where("id", "=", approvedFormId)
        .executeTakeFirstOrThrow();
    const originalFormId = approvedForm.parent_form_id ?? approvedForm.id;

    const approvedPap = await trx
        .selectFrom("form_paps")
        .select("pap_id")
        .where("form_id", "=", approvedFormId)
        .executeTakeFirst();

    if (!approvedPap) {
        throw new Error("Approved proposal is not linked to a PAP.");
    }

    const approvedComponents = await trx
        .selectFrom("cost_by_components")
        .select([
            "item_catalog_id",
            "fund_code",
            "specific_description",
            "currency",
            "proposed_amt",
            "tier",
        ])
        .where("proposal_id", "=", approvedFormId)
        .where("item_catalog_id", "is not", null)
        .execute();

    const originalComponents = await trx
        .selectFrom("cost_by_components")
        .select([
            "item_catalog_id",
            "fund_code",
            "specific_description",
            "proposed_amt",
        ])
        .where("proposal_id", "=", originalFormId)
        .where("item_catalog_id", "is not", null)
        .execute();

    const originalAmountByComponent = new Map(
        originalComponents.map((component) => [
            getComponentAllocationKey(component),
            Number(component.proposed_amt ?? 0),
        ]),
    );

    let createdCount = 0;

    const workflowLogs: Array<{
        allocation_id: string;
        workflow_stage: "dbm_review";
        remarks: string;
        amt_before: number | null;
        amt_after: number | null;
        performed_by: string;
    }> = [];

    const latestPapProposal = await trx
        .selectFrom("form_paps")
        .innerJoin("forms", "forms.id", "form_paps.form_id")
        .select("forms.id")
        .where("form_paps.pap_id", "=", approvedPap.pap_id)
        .orderBy("forms.created_at", "desc")
        .orderBy("forms.version", "desc")
        .executeTakeFirst();

    if (latestPapProposal?.id === approvedFormId) {
        await trx
            .updateTable("paps")
            .set({
                description: proposal.description,
                org_outcome_id: proposal.org_outcome_id,
                purpose: proposal.purpose,
                beneficiaries: proposal.beneficiaries,
                project_type: getPapProjectTypeFromProposalType(proposal.type),
                updated_at: new Date(),
            })
            .where("id", "=", approvedPap.pap_id)
            .execute();
    }

    if (approvedComponents.length === 0) return { createdCount: 0 };

    for (const component of approvedComponents) {
        if (!component.item_catalog_id) continue;
        const itemCatalogId = component.item_catalog_id;

        const proposedAmount =
            originalAmountByComponent.get(
                getComponentAllocationKey(component),
            ) ?? 0;
        const dbmRecommendedAmount = Number(component.proposed_amt ?? 0);
        const duplicate = await trx
            .selectFrom("budget_allocations")
            .select("id")
            .where("budget_cycle_year", "=", proposal.proposal_year)
            .where("entity_id", "=", approvedForm.entity_id)
            .where("pap_code", "=", approvedPap.pap_id)
            .where("item_catalog_id", "=", itemCatalogId)
            .where((eb) =>
                component.fund_code
                    ? eb("fund_code", "=", component.fund_code)
                    : eb("fund_code", "is", null),
            )
            .executeTakeFirst();

        if (duplicate) {
            const existingAllocation = await trx
                .selectFrom("budget_allocations")
                .select(["dbm_rec_amt"])
                .where("id", "=", duplicate.id)
                .executeTakeFirstOrThrow();

            await trx
                .updateTable("budget_allocations")
                .set({
                    proposed_amt: proposedAmount,
                    dbm_rec_amt: dbmRecommendedAmount,
                    currency: component.currency ?? "PHP",
                    specific_description:
                        component.specific_description ?? null,
                    auth_status: "dbm_approved",
                    updated_at: new Date(),
                })
                .where("id", "=", duplicate.id)
                .execute();

            workflowLogs.push({
                allocation_id: duplicate.id,
                workflow_stage: "dbm_review",
                remarks: "Updated tier 2 allocation from DBM-approved proposal.",
                amt_before: Number(existingAllocation.dbm_rec_amt ?? 0),
                amt_after: dbmRecommendedAmount,
                performed_by: performedBy,
            });
        } else {
            const createdAllocation = await trx
                .insertInto("budget_allocations")
                .values({
                    entity_id: approvedForm.entity_id,
                    budget_cycle_year: proposal.proposal_year,
                    pap_code: approvedPap.pap_id,
                    fund_code: component.fund_code ?? null,
                    item_catalog_id: itemCatalogId,
                    tier: 2,
                    specific_description:
                        component.specific_description ?? null,
                    currency: component.currency ?? "PHP",
                    proposed_amt: proposedAmount,
                    dbm_rec_amt: dbmRecommendedAmount,
                    nep_amt: 0,
                    gaa_amt: 0,
                    prev_year_gaa_amt: 0,
                    release_classification: "unclassified",
                    origin_tag: "agency_proposed",
                    auth_status: "dbm_approved",
                })
                .returning(["id"])
                .executeTakeFirstOrThrow();

            const allocationId = createdAllocation.id;
            if (allocationId) {
                workflowLogs.push({
                    allocation_id: allocationId,
                    workflow_stage: "dbm_review",
                    remarks: "Created tier 2 allocation from DBM-approved proposal.",
                    amt_before: null,
                    amt_after: dbmRecommendedAmount,
                    performed_by: performedBy,
                });
            }
        }

        createdCount += 1;
    }

    if (workflowLogs.length > 0) {
        await trx
            .insertInto("allocation_workflow_logs")
            .values(workflowLogs)
            .execute();
    }

    return { createdCount };
}

export async function updateProjectProposal(
    proposalId: string,
    payload: { payload: ProposalWritePayload; auth_status?: string },
) {
    return await db.transaction().execute(async (trx) => {
        const p = payload.payload;
        const auth_status = payload.auth_status;

        console.log(
            "This is the payload received in the repository update function: ",
            p,
        );

        const currentProposal = await trx
            .selectFrom("project_proposals")
            .select(["entity_id", "root_form_id"])
            .where("id", "=", proposalId)
            .executeTakeFirstOrThrow();

        await assertProposalRankAvailable(
            trx,
            currentProposal.entity_id,
            p.proposal_year,
            p.priority_rank,
            currentProposal.root_form_id,
        );

        // 1. Update form status
        if (auth_status) {
            await trx
                .updateTable("forms")
                .set({ auth_status })
                .where("id", "=", proposalId)
                .execute();
        }

        // 2. Wipe existing related data (Cascading Cleanup)
        await sql`
        DELETE FROM cost_sources 
        WHERE id IN (
            SELECT cbc.cost_source_id FROM cost_by_components AS cbc WHERE cbc.proposal_id = ${proposalId}
                UNION 
                SELECT ac.cost_source_id FROM attribution_costs AS ac
                    WHERE ac.attribution_id IN (SELECT lfa.id FROM local_financial_attributions AS lfa WHERE lfa.proposal_id = ${proposalId})
                UNION 
                SELECT lir.cost_source_id FROM local_infrastructure_requirements AS lir WHERE lir.proposal_id = ${proposalId}
                UNION 
                SELECT ll.cost_source_id FROM local_locations AS ll WHERE ll.proposal_id = ${proposalId}
            )
        `.execute(trx);

        // Add the parent table to the manual delete list
        await trx
            .deleteFrom("local_financial_attributions")
            .where("proposal_id", "=", proposalId)
            .execute();

        const nonCostTables = [
            "pap_prerequisites",
            "local_physical_targets",
            "foreign_physical_targets",
            "foreign_financial_targets",
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
                title: p.title,
                proposal_year: p.proposal_year,
                priority_rank: p.priority_rank,
                description: p.description,
                org_outcome_id: p.org_outcome_id,
                purpose: p.purpose,
                beneficiaries: p.beneficiaries,
                myca_issuance: p.myca_issuance,
                total_proposal_currency: p.total_proposal_currency,
                is_new: p.is_new,
                is_infrastructure: p.is_infrastructure,
                for_ict: p.for_ict,
                total_proposal_cost: p.total_proposal_cost,
                updated_at: sql`now()`,
            })
            .where("id", "=", proposalId)
            .execute();

        if (p.is_new) {
            await updateLinkedPapTitleForProposal(trx, proposalId, p.title);
        }

        // 4. Re-insert arrays
        if (p.pap_prerequisites?.length) {
            await trx
                .insertInto("pap_prerequisites")
                .values(
                    p.pap_prerequisites.map((i) => ({
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

        if (auth_status && auth_status !== "draft" && !p.is_new) {
            const linkedPap = await trx
                .selectFrom("form_paps")
                .select("pap_id")
                .where("form_id", "=", proposalId)
                .executeTakeFirst();

            if (linkedPap) {
                await syncProposedExistingPapAllocationsWithExecutor(trx, {
                    entityId: currentProposal.entity_id,
                    fiscalYear: p.proposal_year,
                    papId: linkedPap.pap_id,
                    components: p.cost_by_components,
                });
            }
        }

        if (p.type === "202") {
            if (p.local_financial_attributions?.length) {
                await insertAttributions(
                    trx,
                    proposalId,
                    p.local_financial_attributions,
                );
            }
            if (p.local_infrastructure_requirements?.length) {
                await insertWithCostSource(
                    trx,
                    "local_infrastructure_requirements",
                    proposalId,
                    p.local_infrastructure_requirements,
                    "infra",
                );
            }
            if (p.local_locations?.length) {
                await insertWithCostSource(
                    trx,
                    "local_locations",
                    proposalId,
                    p.local_locations,
                    "loc",
                );
            }
            if (p.local_physical_targets?.length) {
                await trx
                    .insertInto("local_physical_targets")
                    .values(
                        p.local_physical_targets.map((i) => ({
                            ...i,
                            proposal_id: proposalId,
                        })),
                    )
                    .execute();
            }
        } else {
            if (p.foreign_financial_targets?.length) {
                await trx
                    .insertInto("foreign_financial_targets")
                    .values(
                        p.foreign_financial_targets.map((i) => ({
                            ...i,
                            proposal_id: proposalId,
                        })),
                    )
                    .execute();
            }

            if (p.foreign_physical_targets?.length) {
                await insertWithCostSource(
                    trx,
                    "foreign_physical_targets",
                    proposalId,
                    p.foreign_physical_targets,
                    "foreign_physical_targets",
                );
            }
        }

        return { success: true };
    });
}

export async function createDbmProjectProposalOverwrite(
    sourceFormId: string,
    payload: { payload: ProposalWritePayload; auth_status?: string },
) {
    const sourceForm = await db
        .selectFrom("forms")
        .select(["id", "entity_id", "parent_form_id", "version", "auth_status"])
        .where("id", "=", sourceFormId)
        .executeTakeFirstOrThrow();

    const parentFormId = sourceForm.parent_form_id ?? sourceForm.id;

    const existingOverwrite = await db
        .selectFrom("forms")
        .select(["id"])
        .where("parent_form_id", "=", parentFormId)
        .orderBy("version", "desc")
        .executeTakeFirst();

    if (existingOverwrite) {
        await updateProjectProposal(existingOverwrite.id, payload);

        return {
            formId: existingOverwrite.id,
            created: false,
        };
    }

    const created = await createProjectProposal(
        sourceForm.entity_id,
        payload.payload,
        payload.auth_status ?? sourceForm.auth_status ?? "pending_dbm",
        payload.payload.proposal_year,
        parentFormId,
        (sourceForm.version ?? 1) + 1,
    );

    return {
        formId: created.formId,
        created: true,
    };
}

export async function swapDeptProposalRanks(
    proposalIdA: string,
    deptRankA: number,
    proposalIdB: string,
    deptRankB: number,
) {
    return await db.transaction().execute(async (trx) => {
        await trx
            .updateTable("project_proposals")
            .set({ dept_priority_rank: -1 })
            .where("id", "=", proposalIdA)
            .execute();

        await trx
            .updateTable("project_proposals")
            .set({ dept_priority_rank: deptRankA })
            .where("id", "=", proposalIdB)
            .execute();

        await trx
            .updateTable("project_proposals")
            .set({ dept_priority_rank: deptRankB })
            .where("id", "=", proposalIdA)
            .execute();

        return { success: true };
    });
}

export async function swapProposalRanks(
    entityId: string,
    proposalIdA: string,
    rankA: number,
    proposalIdB: string,
    rankB: number,
    proposalYear: number,
) {
    void rankA;
    void rankB;

    return await db.transaction().execute(async (trx) => {
        const proposals = await trx
            .selectFrom("project_proposals")
            .innerJoin("forms", "forms.id", "project_proposals.id")
            .select([
                "project_proposals.id",
                "project_proposals.entity_id",
                "project_proposals.proposal_year",
                "project_proposals.priority_rank",
                "project_proposals.root_form_id",
                "forms.auth_status",
            ])
            .where("project_proposals.id", "in", [proposalIdA, proposalIdB])
            .forUpdate()
            .execute();

        const proposalA = proposals.find(
            (proposal) => proposal.id === proposalIdA,
        );
        const proposalB = proposals.find(
            (proposal) => proposal.id === proposalIdB,
        );

        if (!proposalA || !proposalB) {
            throw new Error("proposal_not_found");
        }

        if (
            proposalA.entity_id !== entityId ||
            proposalB.entity_id !== entityId
        ) {
            throw new Error("proposal_entity_mismatch");
        }

        if (
            proposalA.proposal_year !== proposalYear ||
            proposalB.proposal_year !== proposalYear
        ) {
            throw new Error("proposal_year_mismatch");
        }

        if (
            proposalA.proposal_year !== proposalYear ||
            proposalB.proposal_year !== proposalYear
        ) {
            throw new Error("proposal_year_mismatch");
        }

        if (
            proposalA.proposal_year !== proposalYear ||
            proposalB.proposal_year !== proposalYear
        ) {
            throw new Error("proposal_year_mismatch");
        }

        if (
            proposalA.auth_status !== "draft" ||
            proposalB.auth_status !== "draft"
        ) {
            throw new Error("submitted_rank_change");
        }

        // 1. Move A to a temporary placeholder rank to free up rankA
        await trx
            .updateTable("project_proposals")
            .set({ priority_rank: -1 })
            .where("id", "=", proposalIdA)
            .execute();

        // 2. Move B to A's old rank
        await trx
            .updateTable("project_proposals")
            .set({ priority_rank: Number(proposalA.priority_rank) })
            .where("id", "=", proposalIdB)
            .execute();

        // 3. Move A to B's old rank
        await trx
            .updateTable("project_proposals")
            .set({ priority_rank: Number(proposalB.priority_rank) })
            .where("id", "=", proposalIdA)
            .execute();

        return { success: true };
    });
}

export async function moveProposalToRank(
    entityId: string,
    proposalId: string,
    targetRank: number,
    proposalYear: number,
) {
    return await db.transaction().execute(async (trx) => {
        const proposals = await trx
            .selectFrom("project_proposals")
            .innerJoin("forms", "forms.id", "project_proposals.id")
            .select([
                "project_proposals.id",
                "project_proposals.priority_rank",
                "forms.auth_status",
            ])
            .where("project_proposals.entity_id", "=", entityId)
            .where("project_proposals.parent_form_id", "is", null)
            .where("project_proposals.proposal_year", "=", proposalYear)
            .orderBy("project_proposals.priority_rank", "asc")
            .forUpdate()
            .execute();

        const movingProposal = proposals.find(
            (proposal) => proposal.id === proposalId,
        );

        if (!movingProposal) {
            throw new Error("proposal_not_found");
        }

        if (movingProposal.auth_status !== "draft") {
            throw new Error("submitted_rank_change");
        }

        const boundedTargetRank = Math.max(
            1,
            Math.min(Math.trunc(targetRank), proposals.length),
        );
        const currentRank = Number(movingProposal.priority_rank);

        if (currentRank === boundedTargetRank) {
            return { success: true, changedIds: [] as string[] };
        }

        const affectedProposals = proposals.filter((proposal) => {
            const rank = Number(proposal.priority_rank);

            return currentRank < boundedTargetRank
                ? rank >= currentRank && rank <= boundedTargetRank
                : rank >= boundedTargetRank && rank <= currentRank;
        });

        if (
            affectedProposals.some(
                (proposal) => proposal.auth_status !== "draft",
            )
        ) {
            throw new Error("submitted_rank_change");
        }

        for (const [index, proposal] of affectedProposals.entries()) {
            await trx
                .updateTable("project_proposals")
                .set({ priority_rank: -(index + 1) })
                .where("id", "=", proposal.id)
                .execute();
        }

        for (const proposal of affectedProposals) {
            const rank = Number(proposal.priority_rank);
            let nextRank = rank;

            if (proposal.id === proposalId) {
                nextRank = boundedTargetRank;
            } else if (currentRank < boundedTargetRank) {
                nextRank = rank - 1;
            } else {
                nextRank = rank + 1;
            }

            await trx
                .updateTable("project_proposals")
                .set({ priority_rank: nextRank })
                .where("id", "=", proposal.id)
                .execute();
        }

        return {
            success: true,
            changedIds: affectedProposals.map((proposal) => proposal.id),
        };
    });
}

export async function deleteProjectProposal(id: string) {
    // Relying on ON DELETE CASCADE from the forms table
    await db.deleteFrom("forms").where("id", "=", id).execute();
}

function buildDbmProposalReviewBaseQuery(filters: DbmProposalReviewFilters) {
    let query = db
        .selectFrom("project_proposals as pp")
        .innerJoin("forms as f", "f.id", "pp.id")
        .leftJoin("entities", "entities.id", "f.entity_id")
        .leftJoin("departments", "departments.id", "f.entity_id")
        .leftJoin("agencies", "agencies.id", "f.entity_id")
        .leftJoin("operating_units", "operating_units.id", "f.entity_id")
        .leftJoin(
            "agencies as parent_agencies",
            "parent_agencies.id",
            "operating_units.agency_id",
        )
        .leftJoin(
            "departments as agency_departments",
            "agency_departments.id",
            "agencies.department_id",
        )
        .leftJoin(
            "departments as parent_agency_departments",
            "parent_agency_departments.id",
            "parent_agencies.department_id",
        );

    if (filters.fiscalYear) {
        query = query.where("pp.proposal_year", "=", filters.fiscalYear);
    }

    if (filters.departmentId) {
        query = query.where(({ eb, or }) =>
            or([
                eb("departments.id", "=", filters.departmentId!),
                eb("agency_departments.id", "=", filters.departmentId!),
                eb("parent_agency_departments.id", "=", filters.departmentId!),
            ]),
        );
    }

    if (filters.agencyId) {
        query = query.where(({ eb, or }) =>
            or([
                eb("agencies.id", "=", filters.agencyId!),
                eb("parent_agencies.id", "=", filters.agencyId!),
            ]),
        );
    }

    if (filters.operatingUnitId) {
        query = query.where("operating_units.id", "=", filters.operatingUnitId);
    }

    if (filters.search?.trim()) {
        query = query.where(({ eb, or }) =>
            or([
                eb("pp.title", "ilike", `%${filters.search!.trim()}%`),
                eb("pp.description", "ilike", `%${filters.search!.trim()}%`),
            ]),
        );
    }

    return query;
}

export async function listDbmProposalReviewRows(
    filters: DbmProposalReviewFilters = {},
) {
    const rows = getPaginatedDbmProposalReviewRows(
        await listFilteredDbmProposalReviewBaseRows(filters),
        filters,
    );

    const proposalIds = rows.map((row) => row.id);
    const components = proposalIds.length
        ? ((await db
              .selectFrom("cost_by_components as cbc")
              .leftJoin(
                  "item_catalog",
                  "item_catalog.id",
                  "cbc.item_catalog_id",
              )
              .leftJoin(
                  "cost_by_expense_class as cec",
                  "cec.cost_source_id",
                  "cbc.cost_source_id",
              )
              .leftJoin(
                  "uacs_funding_sources as fund_sources",
                  "fund_sources.code",
                  "cbc.fund_code",
              )
              .select([
                  "cbc.id",
                  "cbc.proposal_id",
                  "cbc.component_name",
                  "cbc.item_catalog_id",
                  "cbc.fund_code",
                  "fund_sources.description as fund_description",
                  "cbc.specific_description",
                  "cbc.currency",
                  "cbc.proposed_amt",
                  "item_catalog.name as item_name",
                  sql<
                      string | null
                  >`COALESCE(item_catalog.expense_class, cec.expense_class)`.as(
                      "expense_class",
                  ),
              ])
              .where("cbc.proposal_id", "in", proposalIds)
              .orderBy("cbc.component_name", "asc")
              .execute()) as (DbmProposalComponent & {
              proposal_id: string;
          })[])
        : [];

    const componentsByProposal = new Map<string, DbmProposalComponent[]>();
    const seenComponentIdsByProposal = new Map<string, Set<string>>();
    for (const component of components) {
        const seenComponentIds =
            seenComponentIdsByProposal.get(component.proposal_id) ??
            new Set<string>();

        if (seenComponentIds.has(component.id)) continue;

        seenComponentIds.add(component.id);
        seenComponentIdsByProposal.set(component.proposal_id, seenComponentIds);

        const current = componentsByProposal.get(component.proposal_id) ?? [];
        current.push(component);
        componentsByProposal.set(component.proposal_id, current);
    }

    return rows.map((row) => ({
        ...row,
        components: componentsByProposal.get(row.id) ?? [],
    })) as DbmProposalReviewRow[];
}

export async function countDbmProposalReviewRows(
    filters: Omit<DbmProposalReviewFilters, "limit" | "offset"> = {},
) {
    return (await listFilteredDbmProposalReviewBaseRows(filters)).length;
}

async function listFilteredDbmProposalReviewBaseRows(
    filters: Omit<DbmProposalReviewFilters, "limit" | "offset"> = {},
) {
    const rows = (await buildDbmProposalReviewBaseQuery(filters)
        .select([
            "pp.id",
            "pp.entity_id",
            "pp.title",
            "pp.proposal_year",
            "pp.priority_rank",
            "pp.type",
            "pp.total_proposal_currency",
            "pp.total_proposal_cost",
            "f.auth_status",
            "f.updated_at",
            "f.parent_form_id",
            "f.version",
            sql<
                string | null
            >`COALESCE(departments.id, agency_departments.id, parent_agency_departments.id)`.as(
                "department_id",
            ),
            sql<
                string | null
            >`COALESCE(departments.name, agency_departments.name, parent_agency_departments.name)`.as(
                "department_name",
            ),
            sql<string | null>`COALESCE(agencies.id, parent_agencies.id)`.as(
                "agency_id",
            ),
            sql<
                string | null
            >`COALESCE(agencies.name, parent_agencies.name)`.as("agency_name"),
            "operating_units.id as operating_unit_id",
            "operating_units.name as operating_unit_name",
            sql<
                string | null
            >`COALESCE(departments.name, agencies.name, operating_units.name)`.as(
                "entity_name",
            ),
        ])
        .orderBy(
            sql`COALESCE(departments.name, agency_departments.name, parent_agency_departments.name)`,
            "asc",
        )
        .orderBy(sql`COALESCE(agencies.name, parent_agencies.name)`, "asc")
        .orderBy("operating_units.name", "asc")
        .orderBy("pp.priority_rank", "asc")
        .orderBy("f.updated_at", "desc")
        .execute()) as DbmProposalReviewBaseRow[];
    const latestByFamily = new Map<string, DbmProposalReviewBaseRow>();

    for (const row of rows) {
        const familyId = row.parent_form_id ?? row.id;
        const current = latestByFamily.get(familyId);

        if (!current || row.version > current.version) {
            latestByFamily.set(familyId, row);
        }
    }

    return Array.from(latestByFamily.values())
        .filter(
            (row) =>
                row.auth_status !== "approved" &&
                row.auth_status !== "rejected",
        )
        .filter((row) => !filters.status || row.auth_status === filters.status)
        .sort((a, b) => {
            const departmentCompare = (a.department_name ?? "").localeCompare(
                b.department_name ?? "",
            );
            if (departmentCompare !== 0) return departmentCompare;

            const agencyCompare = (a.agency_name ?? "").localeCompare(
                b.agency_name ?? "",
            );
            if (agencyCompare !== 0) return agencyCompare;

            const ouCompare = (a.operating_unit_name ?? "").localeCompare(
                b.operating_unit_name ?? "",
            );
            if (ouCompare !== 0) return ouCompare;

            return a.priority_rank - b.priority_rank;
        });
}

function getPaginatedDbmProposalReviewRows(
    rows: DbmProposalReviewBaseRow[],
    filters: DbmProposalReviewFilters,
) {
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? rows.length;

    return rows.slice(offset, offset + limit);
}

export async function updatePendingDbmProposalScopesToRejected(filters: {
    fiscalYear: number;
    departmentId?: string;
    agencyId?: string;
    operatingUnitId?: string;
    performedBy: string;
}) {
    const proposals = await listDbmProposalReviewRows({
        fiscalYear: filters.fiscalYear,
        status: "pending_dbm",
        departmentId: filters.departmentId,
        agencyId: filters.agencyId,
        operatingUnitId: filters.operatingUnitId,
    });

    if (proposals.length === 0) return 0;

    await db.transaction().execute(async (trx) => {
        const proposalIds = proposals.map((proposal) => proposal.id);

        await trx
            .updateTable("forms")
            .set({ auth_status: "rejected", updated_at: sql`now()` })
            .where("id", "in", proposalIds)
            .execute();

        const linkedPaps = await trx
            .selectFrom("form_paps")
            .select("pap_id")
            .where("form_id", "in", proposalIds)
            .execute();

        if (linkedPaps.length > 0) {
            await trx
                .updateTable("paps")
                .set({ project_status: "rejected", updated_at: sql`now()` })
                .where(
                    "id",
                    "in",
                    linkedPaps.map((row) => row.pap_id),
                )
                .execute();
        }

        for (const proposalId of proposalIds) {
            await rejectProposalAllocationsWithExecutor(
                trx,
                proposalId,
                filters.performedBy,
            );
        }
    });

    return proposals.length;
}

export async function rejectProposalAllocationsWithExecutor(
    executor: Transaction<Database>,
    proposalId: string,
    performedBy: string,
) {
    const form = await executor
        .selectFrom("forms")
        .select(["id", "entity_id", "parent_form_id"])
        .where("id", "=", proposalId)
        .executeTakeFirstOrThrow();
    const originalFormId = form.parent_form_id ?? form.id;
    const linkedPap = await executor
        .selectFrom("form_paps")
        .select("pap_id")
        .where("form_id", "=", proposalId)
        .executeTakeFirst();
    const proposal = await executor
        .selectFrom("project_proposals")
        .select("proposal_year")
        .where("id", "=", proposalId)
        .executeTakeFirstOrThrow();

    if (!linkedPap) return { updatedCount: 0 };

    const components = await executor
        .selectFrom("cost_by_components")
        .select(["item_catalog_id", "fund_code", "specific_description"])
        .where("proposal_id", "=", originalFormId)
        .where("item_catalog_id", "is not", null)
        .execute();

    if (components.length === 0) return { updatedCount: 0 };

    let updatedCount = 0;
    const workflowLogs: Array<{
        allocation_id: string;
        workflow_stage: "dbm_review";
        remarks: string;
        amt_before: number | null;
        amt_after: number | null;
        performed_by: string;
    }> = [];

    for (const component of components) {
        if (!component.item_catalog_id) continue;

        const allocation = await executor
            .selectFrom("budget_allocations")
            .select(["id", "dbm_rec_amt"])
            .where("budget_cycle_year", "=", proposal.proposal_year)
            .where("entity_id", "=", form.entity_id)
            .where("pap_code", "=", linkedPap.pap_id)
            .where("item_catalog_id", "=", component.item_catalog_id)
            .where((eb) =>
                component.fund_code
                    ? eb("fund_code", "=", component.fund_code)
                    : eb("fund_code", "is", null),
            )
            .executeTakeFirst();

        if (!allocation) continue;

        await executor
            .updateTable("budget_allocations")
            .set({
                dbm_rec_amt: 0,
                auth_status: "rejected",
                updated_at: sql`now()`,
            })
            .where("id", "=", allocation.id)
            .execute();

        workflowLogs.push({
            allocation_id: allocation.id,
            workflow_stage: "dbm_review",
            remarks: "Rejected by DBM through proposal review.",
            amt_before: Number(allocation.dbm_rec_amt ?? 0),
            amt_after: 0,
            performed_by: performedBy,
        });
        updatedCount += 1;
    }

    if (workflowLogs.length > 0) {
        await executor
            .insertInto("allocation_workflow_logs")
            .values(workflowLogs)
            .execute();
    }

    return { updatedCount };
}

export async function moveDeptProposalToRank(
    proposalId: string,
    targetRank: number,
    proposalYear: number,
) {
    return await db.transaction().execute(async (trx) => {
        const movingProposal = await trx
            .selectFrom("project_proposals as pp")
            .innerJoin("forms as f", "f.id", "pp.id")
            .select([
                "pp.id",
                "pp.dept_priority_rank",
                "pp.proposal_year",
                "f.auth_status",
            ])
            .where("pp.id", "=", proposalId)
            .executeTakeFirst();

        if (!movingProposal) {
            throw new Error("proposal_not_found");
        }

        if (movingProposal.auth_status !== "draft") {
            throw new Error("submitted_rank_change");
        }

        const currentRank = Number(movingProposal.dept_priority_rank);

        const proposals = await trx
            .selectFrom("project_proposals as pp")
            .innerJoin("forms as f", "f.id", "pp.id")
            .select(["pp.id", "pp.dept_priority_rank", "f.auth_status"])
            .where("pp.proposal_year", "=", proposalYear)
            .where("pp.dept_priority_rank", "is not", null)
            .orderBy("pp.dept_priority_rank", "asc")
            .forUpdate()
            .execute();

        const boundedTargetRank = Math.max(
            1,
            Math.min(Math.trunc(targetRank), proposals.length),
        );

        if (currentRank === boundedTargetRank) {
            return { success: true, changedIds: [] as string[] };
        }

        const affectedProposals = proposals.filter((proposal) => {
            const rank = Number(proposal.dept_priority_rank);

            return currentRank < boundedTargetRank
                ? rank >= currentRank && rank <= boundedTargetRank
                : rank >= boundedTargetRank && rank <= currentRank;
        });

        if (
            affectedProposals.some(
                (proposal) => proposal.auth_status !== "draft",
            )
        ) {
            throw new Error("submitted_rank_change");
        }

        // temporary negative ranks
        for (const [index, proposal] of affectedProposals.entries()) {
            await trx
                .updateTable("project_proposals")
                .set({
                    dept_priority_rank: -(index + 1),
                })
                .where("id", "=", proposal.id)
                .execute();
        }

        // assign final ranks
        for (const proposal of affectedProposals) {
            const rank = Number(proposal.dept_priority_rank);
            let nextRank = rank;

            if (proposal.id === proposalId) {
                nextRank = boundedTargetRank;
            } else if (currentRank < boundedTargetRank) {
                nextRank = rank - 1;
            } else {
                nextRank = rank + 1;
            }

            await trx
                .updateTable("project_proposals")
                .set({
                    dept_priority_rank: nextRank,
                })
                .where("id", "=", proposal.id)
                .execute();
        }

        return {
            success: true,
            changedIds: affectedProposals.map((p) => p.id),
        };
    });
}
