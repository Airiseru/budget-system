import {
    EntitiesTable,
    UserTable,
    SessionTable,
    AccountTable,
    VerificationTable,
    DepartmentsTable,
    AgenciesTable,
    OperatingUnitsTable,
    EntityRequestsTable,
} from "./entities";
import { AuditLogTable, MerkleRootTable } from "./audit";
import {
    SalarySchedulesTable,
    SalaryRatesTable,
    CompensationRulesTable,
} from "./salaries";
import { FormTable, FormPapsTable } from "./forms";
import { UserKeyTable, SignatoryTable } from "./keys";
import {
    CostSourceTable,
    CostByExpenseClassTable,
    ProjectProposalTable,
    PAPPrerequisiteTable,
    CostComponentTable,
    LocalFinancialAttributionTable,
    AttributionCostTable,
    LocalPhysicalTargetTable,
    LocalInfrastructureRequirementTable,
    LocalLocationTable,
    ForeignFinancialTargetTable,
    ForeignPhysicalTargetTable,
} from "./project_proposals";
import { PapTable, PapLocationTable } from "./pap";
import {
    PositionTable,
    StaffingTable,
    StaffingSummaryWithPositions,
    CompensationTable,
} from "./staffing";
import { RetireeRecordTable, RetireesListTable } from "./retirees";

export interface Database {
    // users
    users: UserTable;
    sessions: SessionTable;
    accounts: AccountTable;
    verifications: VerificationTable;
    user_keys: UserKeyTable;
    signatories: SignatoryTable;

    // entities
    entities: EntitiesTable;
    departments: DepartmentsTable;
    agencies: AgenciesTable;
    operating_units: OperatingUnitsTable;
    entity_requests: EntityRequestsTable;

    // audit
    audit_logs: AuditLogTable;
    merkle_roots: MerkleRootTable;

    // paps
    paps: PapTable;
    pap_locations: PapLocationTable;

    // salaries
    salary_schedules: SalarySchedulesTable;
    salary_rates: SalaryRatesTable;
    compensation_rules: CompensationRulesTable;

    // forms
    forms: FormTable;
    form_paps: FormPapsTable;
    // bp form 204
    staffing_summaries: StaffingTable;
    positions: PositionTable;
    compensations: CompensationTable;
    staff_with_position: StaffingSummaryWithPositions;
    // bp form 205
    retirees_list: RetireesListTable;
    retirees: RetireeRecordTable;
    // bp form 202 / 203 (Project Proposals)
    cost_sources: CostSourceTable;
    cost_by_expense_class: CostByExpenseClassTable;
    project_proposals: ProjectProposalTable;
    pap_prerequisites: PAPPrerequisiteTable;
    cost_by_components: CostComponentTable;
    // bp form 202 local
    local_financial_attributions: LocalFinancialAttributionTable;
    attribution_costs: AttributionCostTable;
    local_physical_targets: LocalPhysicalTargetTable;
    local_infrastructure_requirements: LocalInfrastructureRequirementTable;
    local_locations: LocalLocationTable;
    // bp form 203 foreign
    foreign_financial_targets: ForeignFinancialTargetTable;
    foreign_physical_targets: ForeignPhysicalTargetTable;
}
