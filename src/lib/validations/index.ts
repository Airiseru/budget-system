import { staffingFormSchema } from "@/src/lib/validations/staffing.schema"
import { RetireesListSchema } from "./retirees"

export function cleanDataBasedOnTable(tableName: string, data: any) {
    switch (tableName) {
        case 'staffing_summaries': {
            return staffingFormSchema.parse(data)
        }
        case 'retirees_list': {
            return RetireesListSchema.parse(data)
        }
        default: {
            console.warn(`No validation for table ${tableName}`)
            return data
        }
    }
}