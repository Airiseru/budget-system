import { EntitiesTable, UserTable, SessionTable, AccountTable, VerificationTable, DepartmentsTable, AgenciesTable, OperatingUnitsTable } from "./entities"
import { FormTable, FormPapsTable } from "./forms";
import { PapTable, PapLocationTable } from "./pap";
import { PositionTable, StaffingTable, StaffingSummaryWithPositions } from "./staffing";

export interface Database {
    entities: EntitiesTable
    users: UserTable
    sessions: SessionTable
    accounts: AccountTable
    verifications: VerificationTable
    departments: DepartmentsTable
    agencies: AgenciesTable
    operating_units: OperatingUnitsTable
    pap: PapTable
    pap_location: PapLocationTable
    // forms
    forms: FormTable
    form_paps: FormPapsTable
    staffing_summary: StaffingTable;
    position: PositionTable;
    staff_with_position: StaffingSummaryWithPositions;
}