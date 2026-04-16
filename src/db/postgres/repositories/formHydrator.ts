import { db } from "../database"
import * as StaffingRepository from "./staffingRepository"
import { StaffingSummarySchema } from "@/src/lib/validations/staffing"

export async function fetchHydratedFormState(tableName: string, recordId: string) {
    switch (tableName) {
        case 'staffing_summaries': {
            const staffing = await StaffingRepository.getStaffingWithFormById(recordId)
            return StaffingSummarySchema.parse(staffing)
        }

        default: {
            console.warn(`No hydration for table ${tableName}`)
            return await db.selectFrom(tableName as any).selectAll().where('id', '=', recordId).executeTakeFirst()
        }
    }
}