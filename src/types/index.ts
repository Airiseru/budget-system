import { EntitiesTable, UserTable, SessionTable, AccountTable, VerificationTable, DepartmentsTable, AgenciesTable, OperatingUnitsTable } from "./entities"
import { FormTable, FormPapsTable } from "./forms";
import { UserKeyTable, SignatoryTable } from "./keys"
import { PapTable, PapLocationTable } from "./pap";
import { PositionTable, StaffingTable, StaffingSummaryWithPositions, CompensationTable } from "./staffing";

export interface Database {
    entities: EntitiesTable
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
    staffing_summaries: StaffingTable;
    positions: PositionTable;
    compensations: CompensationTable;
    staff_with_position: StaffingSummaryWithPositions;
}