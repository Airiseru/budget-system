import { staffingFormSchema } from "@/src/lib/validations/staffing.schema"
import { retireeFormSchema } from "@/src/lib/validations/retiree.schema"
import { normalizeProposalPayload } from "@/src/lib/validations/proposal.schema"

function withProposalSchemaPapId(data: unknown) {
    if (typeof data !== "object" || data === null) return data

    const proposal = data as {
        is_new?: boolean | null
        pap_id?: string | null
        existing_pap_id?: string | null
    }
    const existingPapId = proposal.is_new === false
        ? proposal.existing_pap_id ?? proposal.pap_id ?? ""
        : proposal.existing_pap_id ?? ""

    return {
        ...proposal,
        existing_pap_id: existingPapId,
    }
}

export function cleanDataBasedOnTable(tableName: string, data: unknown) {
    switch (tableName) {
        case 'staffing_summaries': {
            return staffingFormSchema.parse(data)
        }
        case 'retirees_list': {
            return retireeFormSchema.parse(data)
        }
        case 'project_proposals': {
            return normalizeProposalPayload(withProposalSchemaPapId(data))
        }
        default: {
            console.warn(`No validation for table ${tableName}`)
            return data
        }
    }
}
