import { EntitiesTable, UserTable, SessionTable, AccountTable, VerificationTable, DepartmentsTable, AgenciesTable, OperatingUnitsTable } from "./entities"
import { AuditLogTable, MerkleRootTable } from "./audit"
import { SalarySchedulesTable, SalaryRatesTable, CompensationRulesTable } from "./salaries"
import { FormTable, FormPapsTable } from "./forms"
import { UserKeyTable, SignatoryTable } from "./keys"
import { PapTable, PapLocationTable } from "./pap"
import { PositionTable, StaffingTable, StaffingSummaryWithPositions, CompensationTable } from "./staffing"
import { RetireeRecordTable, RetireesListTable } from "./retirees"

export interface Database {
    // users
    users: UserTable
    sessions: SessionTable
    accounts: AccountTable
    verifications: VerificationTable
    user_keys: UserKeyTable
    signatories: SignatoryTable
    
    // entities
    entities: EntitiesTable
    departments: DepartmentsTable
    agencies: AgenciesTable
    operating_units: OperatingUnitsTable
    
    // audit
    audit_logs: AuditLogTable
    merkle_roots: MerkleRootTable

    // paps
    paps: PapTable
    pap_locations: PapLocationTable

    // salaries
    salary_schedules: SalarySchedulesTable
    salary_rates: SalaryRatesTable
    compensation_rules: CompensationRulesTable

    // forms
    forms: FormTable
    form_paps: FormPapsTable

    // bp form 204
    staffing_summaries: StaffingTable
    positions: PositionTable
    compensations: CompensationTable
    staff_with_position: StaffingSummaryWithPositions

    // bp form 205
    retirees_list: RetireesListTable
    retirees: RetireeRecordTable
}