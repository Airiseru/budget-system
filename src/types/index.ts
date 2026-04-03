import { EntitiesTable, UserTable, SessionTable, AccountTable, VerificationTable, DepartmentsTable, AgenciesTable, OperatingUnitsTable } from "./entities"
import { FormTable } from "./forms";
import { PapTable, PapLocationTable } from "./pap";
import { PositionTable, StaffingTable } from "./staffing";

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
    staffing_summary: StaffingTable;
    position: PositionTable;

}