import * as StaffingRepository from "./staffingRepository"
import { staffingFormSchema } from "@/src/lib/validations/staffing.schema"
import * as RetireeRepository from "./retireeRepository"
import { retireeFormSchema } from "@/src/lib/validations/retiree.schema"
import * as ProposalRepository from "./proposalRepository"
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

export async function fetchHydratedFormState(tableName: string, recordId: string) {
    switch (tableName) {
        case 'staffing_summaries': {
            const staffing = await StaffingRepository.getStaffingWithFormById(recordId)
            return staffingFormSchema.parse(staffing)
        }

        case 'retirees_list': {
            const retirees = await RetireeRepository.getRetireesFormById(recordId)
            return retireeFormSchema.parse(retirees)
        }

        case 'project_proposals': {
            const proposal = await ProposalRepository.getProjectProposalById(recordId)
            return normalizeProposalPayload(withProposalSchemaPapId(proposal))
        }

        default: {
            console.warn(`No hydration for table ${tableName}`)
            return {}
        }
    }
}
