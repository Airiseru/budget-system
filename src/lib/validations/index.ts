import { StaffingSummarySchema } from "./staffing"

export function cleanDataBasedOnTable(tableName: string, data: any) {
    switch (tableName) {
        case 'staffing_summaries': {
            return StaffingSummarySchema.parse(data)
        }
        default: {
            console.warn(`No validation for table ${tableName}`)
            return data
        }
    }
}