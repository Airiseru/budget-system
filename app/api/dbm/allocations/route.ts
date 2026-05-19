import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/src/lib/auth'
import { createAuditRepository, createBudgetAllocationRepository, createBudgetSettingsRepository } from '@/src/db/factory'
import { LegislativeInsertionSchema } from '@/src/lib/validations/budgetAllocations'
import { parseDateOnlyToUtcNoon } from '@/src/lib/dateOnly'
import {
    getAllocationAuditRecordId,
    normalizeAuditDate,
    type AllocationAuditPayload,
} from '@/src/lib/allocation-audit'

const BudgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const AuditRepository = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')

export async function POST(request: Request) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || session.user.role !== 'dbm') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeCycle = await BudgetSettingsRepository.getActiveBudgetCycle()
    if (!activeCycle || activeCycle.current_phase !== 'legislative_deliberation') {
        return NextResponse.json(
            { error: 'Legislative insertions are only available during legislative deliberation.' },
            { status: 403 }
        )
    }

    const body = await request.json()
    if (typeof body.gaa_amt === 'number' || typeof body.gaa_amt === 'string') {
        const parsedAmount = Number(body.gaa_amt)
        if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
            return NextResponse.json(
                { error: { gaa_amt: ['GAA amount must be a non-negative number.'] } },
                { status: 400 }
            )
        }
    }
    const parsed = LegislativeInsertionSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten().fieldErrors },
            { status: 400 }
        )
    }

    try {
        const created = await BudgetAllocationRepository.createBudgetAllocation({
            entity_id: parsed.data.entity_id,
            budget_cycle_year: activeCycle.fiscal_year,
            pap_code: parsed.data.pap_code,
            fund_code: parsed.data.fund_code,
            item_catalog_id: parsed.data.item_catalog_id,
            tier: parsed.data.tier,
            specific_description: parsed.data.specific_description,
            currency: parsed.data.currency,
            release_classification: 'unclassified',
            origin_tag: 'legislative_insertion',
            proposed_amt: 0,
            dbm_rec_amt: 0,
            nep_amt: 0,
            gaa_amt: parsed.data.gaa_amt,
            prev_year_gaa_amt: 0,
            valid_from: parsed.data.valid_from ? parseDateOnlyToUtcNoon(parsed.data.valid_from) : null,
            valid_until: parsed.data.valid_until ? parseDateOnlyToUtcNoon(parsed.data.valid_until) : null,
            auth_status: 'nep_approved',
        })

        await BudgetAllocationRepository.createAllocationWorkflowLog({
            allocation_id: created.id,
            workflow_stage: 'congressional_bicam',
            remarks: 'Created a legislative insertion line item.',
            amt_before: null,
            amt_after: created.gaa_amt,
            performed_by: session.user.id,
        })

        const auditPayload: AllocationAuditPayload = {
            allocation_id: created.id,
            fiscal_year: activeCycle.fiscal_year,
            workflow_stage: 'congressional_bicam',
            inserted_allocation: {
                entity_id: created.entity_id,
                pap_code: created.pap_code,
                fund_code: created.fund_code,
                item_catalog_id: created.item_catalog_id,
                tier: created.tier,
                gaa_amt: Number(created.gaa_amt),
                valid_from: normalizeAuditDate(created.valid_from),
                valid_until: normalizeAuditDate(created.valid_until),
            },
            action: 'insert_legislative_allocation',
        }

        await AuditRepository.createLog({
            entity_id: created.entity_id,
            user_id: session.user.id,
            event_type: 'INSERT_LEGISLATIVE_ALLOCATION',
            table_name: 'budget_allocations',
            record_id: getAllocationAuditRecordId('gaa', activeCycle.fiscal_year),
            payload: auditPayload,
            changed_at: new Date(),
            public_key_snapshot: null,
            signature: null,
        }, null)

        return NextResponse.json({ success: true, allocation: created })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create legislative insertion.' },
            { status: 409 }
        )
    }
}
