"use server"

import { createFormRepository } from "@/src/db/factory"
import { logSubmitForm } from "./audit"
import { sessionWithEntity } from "./auth"
import { getBudgetPrepClosedError, isBudgetPrepActiveForYear } from "@/src/lib/budget-cycle"

const formRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

export async function submitForm(
    formId: string,
    formData: Record<string, unknown>,
    userId: string,
    entityId: string,
    tableName: string,
    newStatus: string,
) {
    try {
        const session = await sessionWithEntity()

        if (!session) throw new Error('Unauthorized')
        if (session.user.access_level !== 'encode') throw new Error('Unauthorized')

        const fiscalYear =
            tableName === 'staffing_summaries'
                ? Number(formData.fiscal_year)
                : tableName === 'retirees_list'
                    ? Number(formData.fiscal_year)
                    : tableName === 'project_proposals'
                        ? Number(formData.proposal_year)
                        : NaN

        if (Number.isFinite(fiscalYear) && !(await isBudgetPrepActiveForYear(fiscalYear))) {
            throw new Error(getBudgetPrepClosedError(fiscalYear))
        }
        
        const result = await formRepository.updateFormAuthStatus(formId, newStatus)

        // Log the result
        const logResult = await logSubmitForm(
            userId,
            entityId,
            tableName,
            formId,
            formData,
            result.updated_at
        )

        if (!logResult.success) throw new Error('Failed to log form update')
        return logResult
    } catch {
        throw new Error ('Failed to submit form')
    }
}
