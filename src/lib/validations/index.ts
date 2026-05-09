import { staffingFormSchema } from "@/src/lib/validations/staffing.schema"
import { retireeFormSchema } from "@/src/lib/validations/retiree.schema"
import { ProposalSchema } from "@/src/lib/validations/proposal.schema"

export function cleanDataBasedOnTable(tableName: string, data: unknown) {
    switch (tableName) {
        case 'staffing_summaries': {
            return staffingFormSchema.parse(data)
        }
        case 'retirees_list': {
            return retireeFormSchema.parse(data)
        }
        case 'project_proposals': {
            return ProposalSchema.parse(data)
        }
        default: {
            console.warn(`No validation for table ${tableName}`)
            return data
        }
    }
}
