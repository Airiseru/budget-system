import { PapTable, PapLocationTable } from "./pap";

export interface Database {
    pap: PapTable
    pap_location: PapLocationTable
}