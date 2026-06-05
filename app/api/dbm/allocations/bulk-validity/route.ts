import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/src/lib/auth'
import { createAuditRepository, createBudgetAllocationRepository, createBudgetSettingsRepository } from '@/src/db/factory'
import { BulkValidityUpdateSchema } from '@/src/lib/validations/budgetAllocations'
import { parseDateOnlyToUtcNoon } from '@/src/lib/dateOnly'
import {
    getAllocationAuditRecordId,
    hasFieldChanges,
    normalizeAuditDate,
    type AllocationAuditPayload,
    type AllocationFieldChange,
} from '@/src/lib/allocation-audit'

const BudgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const AuditRepository = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')

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
        ['expense_class', 'expense_class_and_tier'].includes(parsed.data.scope)
            ? parsed.data.expense_class as 'PS' | 'MOOE' | 'CO' | 'FINEX' | undefined
            : undefined,
        ['tier', 'expense_class_and_tier'].includes(parsed.data.scope)
            ? parsed.data.tier
            : undefined
    )

    const validFrom = parsed.data.valid_from ? parseDateOnlyToUtcNoon(parsed.data.valid_from) : null
    const validUntil = parsed.data.valid_until ? parseDateOnlyToUtcNoon(parsed.data.valid_until) : null

    await BudgetAllocationRepository.bulkUpdateAllocationValidity({
        fiscalYear: activeCycle.fiscal_year,
        expenseClass: ['expense_class', 'expense_class_and_tier'].includes(parsed.data.scope)
            ? parsed.data.expense_class as 'PS' | 'MOOE' | 'CO' | 'FINEX' | undefined
            : undefined,
        tier: ['tier', 'expense_class_and_tier'].includes(parsed.data.scope)
            ? parsed.data.tier
            : undefined,
        validFrom,
        validUntil,
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

    for (const target of targets) {
        const fieldChanges: Record<string, AllocationFieldChange> = {
            valid_from: {
                from: normalizeAuditDate(target.valid_from),
                to: normalizeAuditDate(validFrom),
            },
            valid_until: {
                from: normalizeAuditDate(target.valid_until),
                to: normalizeAuditDate(validUntil),
            },
        }

        if (!hasFieldChanges(fieldChanges)) {
            continue
        }

        const auditPayload: AllocationAuditPayload = {
            allocation_id: target.id,
            fiscal_year: activeCycle.fiscal_year,
            workflow_stage: 'congressional_bicam',
            field_changes: fieldChanges,
            scope: {
                type: parsed.data.scope,
                expense_class: ['expense_class', 'expense_class_and_tier'].includes(parsed.data.scope)
                    ? parsed.data.expense_class ?? null
                    : null,
                tier: ['tier', 'expense_class_and_tier'].includes(parsed.data.scope)
                    ? parsed.data.tier ?? null
                    : null,
            },
            action: 'bulk_update_allocation_validity',
        }

        await AuditRepository.createLog({
            entity_id: target.entity_id,
            user_id: session.user.id,
            event_type: 'BULK_UPDATE_ALLOCATION_VALIDITY',
            table_name: 'budget_allocations',
            record_id: getAllocationAuditRecordId('gaa', activeCycle.fiscal_year),
            payload: auditPayload,
            changed_at: new Date(),
            public_key_snapshot: null,
            signature: null,
        }, null)
    }

    return NextResponse.json({ success: true, updatedCount: targets.length })
}
