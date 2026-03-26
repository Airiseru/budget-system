import { EntitiesTable, UserTable, SessionTable, AccountTable, VerificationTable, DepartmentsTable, AgenciesTable } from "./entities"
import { PapTable, PapLocationTable } from "./pap";

export interface Database {
    entities: EntitiesTable
    users: UserTable
    sessions: SessionTable
    accounts: AccountTable
    verifications: VerificationTable
    departments: DepartmentsTable
    agencies: AgenciesTable
    pap: PapTable
    pap_location: PapLocationTable
}