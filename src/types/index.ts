import { EntitiesTable, UserTable, SessionTable, AccountTable, VerificationTable, DepartmentsTable, AgenciesTable, OperatingUnitsTable } from "./entities"
import { AuditLogTable, MerkleRootTable } from "./audit";
import { FormTable, FormPapsTable } from "./forms";
import { UserKeyTable, SignatoryTable } from "./keys"
import { PapTable, PapLocationTable } from "./pap";
import { PositionTable, StaffingTable, StaffingSummaryWithPositions, CompensationTable } from "./staffing";
import { RetireeRecordTable, RetireesListTable } from "./retirees";

export interface Database {
    entities: EntitiesTable
    audit_logs: AuditLogTable
    merkle_roots: MerkleRootTable
    users: UserTable
    sessions: SessionTable
    accounts: AccountTable
    verifications: VerificationTable
    user_keys: UserKeyTable
    signatories: SignatoryTable
    departments: DepartmentsTable
    agencies: AgenciesTable
    operating_units: OperatingUnitsTable
    paps: PapTable
    pap_locations: PapLocationTable
    // forms
    forms: FormTable
    form_paps: FormPapsTable
    // bp form 204
    staffing_summaries: StaffingTable;
    positions: PositionTable;
    compensations: CompensationTable;
    staff_with_position: StaffingSummaryWithPositions;
    // bp form 205
    retirees_list: RetireesListTable;
    retirees: RetireeRecordTable;

}