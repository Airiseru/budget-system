import {
    Generated,
    ColumnType,
    Insertable,
    Selectable,
    Updateable,
} from "kysely";

export interface ProjectProposalTable {
    id: Generated<string>;
    parent_form_id: string | null;
    root_form_id: string;
    entity_id: string;
    title: string;
    proposal_year: number;
    priority_rank: number;
    dept_priority_rank: number | null;
    description: string;
    org_outcome_id: string;
    purpose: string;
    beneficiaries: string;
    is_new: boolean;
    myca_issuance: boolean;
    is_infrastructure: boolean;
    for_ict: boolean | null;
    total_proposal_currency: string;
    total_proposal_cost: number;
    type: "202" | "203";
    submission_date: Generated<Date>;
    created_at: Generated<Date>;
    updated_at: ColumnType<Date, never, Date>;
}

export type ProjectProposal = Selectable<ProjectProposalTable>;
export type NewProjectProposal = Insertable<ProjectProposalTable>;
export type ProjectProposalUpdate = Updateable<ProjectProposalTable>;

export interface PAPPrerequisiteTable {
    id: Generated<string>;
    proposal_id: string;
    name: string;
    type: string;
    status: string;
    remarks: string | null;
}
export type PAPPrerequisite = Selectable<PAPPrerequisiteTable>;

export interface CostComponentTable {
    id: Generated<string>;
    proposal_id: string;
    component_name: string;
    item_catalog_id: string | null;
    fund_code: string | null;
    specific_description: string | null;
    currency: string;
    proposed_amt: number;
    tier: 2;
    cost_source_id: string;
}
export type CostComponent = Selectable<CostComponentTable>;

export interface LocalFinancialAttributionTable {
    id: Generated<string>;
    proposal_id: string;
    description: string;
}
export type LocalFinancialAttribution =
    Selectable<LocalFinancialAttributionTable>;

export interface AttributionCostTable {
    id: Generated<string>;
    attribution_id: string;
    year: number;
    tier: 1 | 2;
    cost_source_id: string;
}
export type AttributionCost = Selectable<AttributionCostTable>;

export interface LocalPhysicalTargetTable {
    id: Generated<string>;
    proposal_id: string;
    year: number;
    tier: 1 | 2;
    target_description: string;
}
export type LocalPhysicalTarget = Selectable<LocalPhysicalTargetTable>;

export interface LocalLocationTable {
    id: Generated<string>;
    proposal_id: string;
    location: string;
    cost_source_id: string;
}
export type LocalLocation = Selectable<LocalLocationTable>;

export interface LocalInfrastructureRequirementTable {
    id: Generated<string>;
    proposal_id: string;
    description: string;
    year: number;
    total_amt: number;
    cost_source_id: string;
}

export type LocalInfrastructureRequirement =
    Selectable<LocalInfrastructureRequirementTable>;

export interface ForeignFinancialTargetTable {
    id: Generated<string>;
    proposal_id: string;
    year: number;
    lp_imprest: number;
    lp_direct: number;
    grant: number;
    gop: number;
}
export type ForeignFinancialTarget = Selectable<ForeignFinancialTargetTable>;

export interface ForeignPhysicalTargetTable {
    id: Generated<string>;
    proposal_id: string;
    name: string;
    cost_source_id: string;
}
export type ForeignPhysicalTarget = Selectable<ForeignPhysicalTargetTable>;

export interface FullProjectProposal extends ProjectProposal {
    prerequisites: PAPPrerequisite[];
    components: CostComponent[];
    cost_by_components?: (CostComponent & {
        fund_description?: string | null;
        costs?: CostByExpenseClass[];
    })[];
    financial_attributions?: LocalFinancialAttribution[];
    physical_targets?: LocalPhysicalTarget[];
    locations?: LocalLocation[];
    foreign_financials?: ForeignFinancialTarget[];
    foreign_physical_targets?: ForeignPhysicalTarget[];
    auth_status: string | null;
    pap_id?: string | null;
    version?: number | null;
}

export interface CostSourceTable {
    id: Generated<string>;
    type: string;
}
export type CostSource = Selectable<CostSourceTable>;

export interface CostByExpenseClassTable {
    id: Generated<string>;
    cost_source_id: string;
    expense_class: "PS" | "MOOE" | "CO" | "FINEX";
    fund_category: "LP" | "Grant" | "GOP" | null;
    fund_method: "cash" | "non-cash" | null;
    currency: string;
    amount: number;
}
export type CostByExpenseClass = Selectable<CostByExpenseClassTable>;
