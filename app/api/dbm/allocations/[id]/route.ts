import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/src/lib/auth'
import { createAuditRepository, createBudgetAllocationRepository, createBudgetSettingsRepository } from '@/src/db/factory'
import { parseDateOnlyToUtcNoon } from '@/src/lib/dateOnly'
import {
    getAllocationAmountAuditEventType,
    getAllocationAuditRecordId,
    getAllocationAuditRecordTypeForField,
    hasFieldChanges,
    normalizeAuditDate,
    type AllocationAuditPayload,
    type AllocationFieldChange,
} from '@/src/lib/allocation-audit'
import type { AuditEventType } from '@/src/types/audit'

const BudgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const AuditRepository = createAuditRepository(process.env.DATABASE_TYPE || 'postgres')

function clampNonNegativeNumber(rawValue: string) {
    const parsed = Number(rawValue || 0)
    if (!Number.isFinite(parsed)) {
        return NaN
    }
    return Math.max(0, parsed)
}

const WORKFLOW_STAGE_BY_FIELD = {
    dbm_rec_amt: 'dbm_review',
    nep_amt: 'presidential_review',
    gaa_amt: 'congressional_bicam',
    valid_from: 'congressional_bicam',
    valid_until: 'congressional_bicam',
} as const

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || session.user.role !== 'dbm') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const action = body.action as 'update_field' | 'remove_line_item' | undefined
    const field = body.field as keyof typeof WORKFLOW_STAGE_BY_FIELD | undefined
    const rawValue = body.value as string | undefined

    if (action !== 'remove_line_item' && (!field || rawValue === undefined)) {
        return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 })
    }

    const allocation = await BudgetAllocationRepository.getBudgetAllocationById(id)
    if (!allocation) {
        return NextResponse.json({ error: 'Allocation not found' }, { status: 404 })
    }

    const activeCycle = await BudgetSettingsRepository.getActiveBudgetCycle()
    if (!activeCycle || activeCycle.fiscal_year !== allocation.budget_cycle_year) {
        return NextResponse.json({ error: 'This fiscal year is not currently editable.' }, { status: 403 })
    }

    const phase = activeCycle.current_phase
    if (field === 'dbm_rec_amt' && !['preparation', 'dbm_review'].includes(phase)) {
        return NextResponse.json({ error: 'DBM recommended amounts can only be updated during preparation or DBM review.' }, { status: 403 })
    }
    if (field === 'nep_amt' && phase !== 'presidential_approval') {
        return NextResponse.json({ error: 'NEP amounts can only be updated during the presidential approval phase.' }, { status: 403 })
    }
    if ((field === 'gaa_amt' || field === 'valid_from' || field === 'valid_until') && phase !== 'legislative_deliberation') {
        return NextResponse.json({ error: 'GAA updates can only be made during legislative deliberation.' }, { status: 403 })
    }

    if (action === 'remove_line_item' && phase !== 'legislative_deliberation') {
        return NextResponse.json({ error: 'Line items can only be removed during legislative deliberation.' }, { status: 403 })
    }

    let update: Record<string, Date | number | null> = {}
    if (action === 'remove_line_item') {
        update = { gaa_amt: 0 }
    } else if (field === 'valid_from' || field === 'valid_until') {
        update = { [field]: rawValue ? parseDateOnlyToUtcNoon(rawValue) : null }
    } else if (field) {
        const clampedValue = clampNonNegativeNumber(rawValue!)
        if (!Number.isFinite(clampedValue)) {
            return NextResponse.json({ error: 'Amount must be a valid non-negative number.' }, { status: 400 })
        }
        update = { [field]: clampedValue }
    }

    const amountBefore =
        field === 'dbm_rec_amt'
            ? Number(allocation.dbm_rec_amt)
            : field === 'nep_amt'
            ? Number(allocation.nep_amt)
            : field === 'gaa_amt'
            ? Number(allocation.gaa_amt)
            : action === 'remove_line_item'
            ? Number(allocation.gaa_amt)
            : null

    const updated = await BudgetAllocationRepository.updateBudgetAllocation(id, update)
    const amountAfter =
        field === 'dbm_rec_amt'
            ? Number(updated.dbm_rec_amt)
            : field === 'nep_amt'
            ? Number(updated.nep_amt)
            : field === 'gaa_amt'
            ? Number(updated.gaa_amt)
            : action === 'remove_line_item'
            ? Number(updated.gaa_amt)
            : null

    await BudgetAllocationRepository.createAllocationWorkflowLog({
        allocation_id: id,
        workflow_stage: action === 'remove_line_item' ? 'congressional_bicam' : WORKFLOW_STAGE_BY_FIELD[field!],
        remarks:
            action === 'remove_line_item'
                ? 'Marked line item as removed in GAA.'
                : field === 'valid_from' || field === 'valid_until'
                ? `Updated ${field.replace('_', ' ')}.`
                : `Updated ${field!.replace(/_/g, ' ')} to ${rawValue}.`,
        amt_before: amountBefore,
        amt_after: amountAfter,
        performed_by: session.user.id,
    })

    let auditEventType: AuditEventType | null = null
    let auditRecordField = field
    let fieldChanges: Record<string, AllocationFieldChange> = {}

    if (action === 'remove_line_item') {
        auditEventType = 'REMOVE_GAA_ALLOCATION'
        auditRecordField = 'gaa_amt'
        fieldChanges = {
            gaa_amt: {
                from: amountBefore,
                to: amountAfter,
            },
        }
    } else if (field === 'valid_from' || field === 'valid_until') {
        auditEventType = 'UPDATE_ALLOCATION_VALIDITY'
        fieldChanges = {
            [field]: {
                from: normalizeAuditDate(allocation[field]),
                to: normalizeAuditDate(updated[field]),
            },
        }
    } else if (field && amountBefore !== null && amountAfter !== null) {
        auditEventType = getAllocationAmountAuditEventType({
            field,
            before: amountBefore,
            after: amountAfter,
        })
        fieldChanges = {
            [field]: {
                from: amountBefore,
                to: amountAfter,
            },
        }
    }

    if (auditEventType && auditRecordField && hasFieldChanges(fieldChanges)) {
        const recordType = action === 'remove_line_item'
            ? 'gaa'
            : getAllocationAuditRecordTypeForField(auditRecordField)
        const auditPayload: AllocationAuditPayload = {
            allocation_id: id,
            fiscal_year: allocation.budget_cycle_year,
            workflow_stage: action === 'remove_line_item' ? 'congressional_bicam' : WORKFLOW_STAGE_BY_FIELD[auditRecordField],
            field_changes: fieldChanges,
            action: action === 'remove_line_item' ? 'remove_line_item' : 'update_field',
        }

        await AuditRepository.createLog({
            entity_id: allocation.entity_id,
            user_id: session.user.id,
            event_type: auditEventType,
            table_name: 'budget_allocations',
            record_id: getAllocationAuditRecordId(recordType, allocation.budget_cycle_year),
            payload: auditPayload,
            changed_at: new Date(),
            public_key_snapshot: null,
            signature: null,
        }, null)
    }

    return NextResponse.json({ success: true, allocation: updated })
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session || session.user.role !== 'dbm') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const allocation = await BudgetAllocationRepository.getBudgetAllocationById(id)
    if (!allocation) {
        return NextResponse.json({ error: 'Allocation not found' }, { status: 404 })
    }

    const logs = await BudgetAllocationRepository.listAllocationWorkflowLogs(id)
    return NextResponse.json({ allocation, logs })
}
