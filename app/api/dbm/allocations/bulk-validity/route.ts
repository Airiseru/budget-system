import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/src/lib/auth'
import { createBudgetAllocationRepository, createBudgetSettingsRepository } from '@/src/db/factory'
import { BulkValidityUpdateSchema } from '@/src/lib/validations/budgetAllocations'
import { parseDateOnlyToUtcNoon } from '@/src/lib/dateOnly'

const BudgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')

export async function PATCH(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || session.user.role !== 'dbm') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeCycle = await BudgetSettingsRepository.getActiveBudgetCycle()
    if (!activeCycle || activeCycle.current_phase !== 'legislative_deliberation') {
        return NextResponse.json(
            { error: 'Bulk validity updates are only available during legislative deliberation.' },
            { status: 403 }
        )
    }

    const body = await request.json()
    const parsed = BulkValidityUpdateSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten().fieldErrors },
            { status: 400 }
        )
    }

    const targets = await BudgetAllocationRepository.listAllocationsForValidityUpdate(
        activeCycle.fiscal_year,
        parsed.data.scope === 'all' ? undefined : parsed.data.expense_class as 'PS' | 'MOOE' | 'CO' | 'FINEX' | undefined,
        parsed.data.scope === 'expense_class_and_tier' ? parsed.data.tier : undefined
    )

    await BudgetAllocationRepository.bulkUpdateAllocationValidity({
        fiscalYear: activeCycle.fiscal_year,
        expenseClass: parsed.data.scope === 'all' ? undefined : parsed.data.expense_class as 'PS' | 'MOOE' | 'CO' | 'FINEX' | undefined,
        tier: parsed.data.scope === 'expense_class_and_tier' ? parsed.data.tier : undefined,
        validFrom: parsed.data.valid_from ? parseDateOnlyToUtcNoon(parsed.data.valid_from) : null,
        validUntil: parsed.data.valid_until ? parseDateOnlyToUtcNoon(parsed.data.valid_until) : null,
    })

    await BudgetAllocationRepository.createAllocationWorkflowLogs(
        targets.map((target) => ({
            allocation_id: target.id,
            workflow_stage: 'congressional_bicam',
            remarks: 'Updated allocation validity in bulk.',
            amt_before: null,
            amt_after: null,
            performed_by: session.user.id,
        }))
    )

    return NextResponse.json({ success: true, updatedCount: targets.length })
}
