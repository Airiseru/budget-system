import { db } from "../database"
import * as StaffingRepository from "./staffingRepository"

export async function fetchHydratedFormState(tableName: string, recordId: string) {
    switch (tableName) {
        case 'staffing_summaries': {
            return await StaffingRepository.getStaffingWithPositions(recordId)
        }

        default: {
            console.warn(`No hydration for table ${tableName}`)
            return await db.selectFrom(tableName as any).selectAll().where('id', '=', recordId).executeTakeFirst()
        }
    }
}