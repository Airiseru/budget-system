import * as StaffingRepository from "./staffingRepository"
import { staffingFormSchema } from "@/src/lib/validations/staffing.schema"
import * as RetireeRepository from "./retireeRepository"
import { retireeFormSchema } from "@/src/lib/validations/retiree.schema"
import * as ProposalRepository from "./proposalRepository"
import { ProposalSchema } from "@/src/lib/validations/proposal.schema"

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
            return ProposalSchema.parse(proposal)
        }

        default: {
            console.warn(`No hydration for table ${tableName}`)
            return {}
        }
    }
}
