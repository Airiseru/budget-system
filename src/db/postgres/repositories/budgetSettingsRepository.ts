import { sql } from 'kysely'
import { db } from '../database'
import { BudgetCycle, NewBudgetCycle, BudgetCycleUpdate } from '@/src/types/budget_settings'

function normalizeCycleState(
    prepStatus: BudgetCycle['prep_status'],
    currentPhase: BudgetCycle['current_phase']
) {
    if (prepStatus === 'closed') {
        return {
            prep_status: 'closed' as const,
            current_phase: 'preparation' as const,
        }
    }

    if (prepStatus === 'locked' || currentPhase === 'enacted_gaa') {
        return {
            prep_status: 'locked' as const,
            current_phase: 'enacted_gaa' as const,
        }
    }

    return {
        prep_status: 'active' as const,
        current_phase: currentPhase,
    }
}

export async function listBudgetCycles(): Promise<BudgetCycle[]> {
    return await db
        .selectFrom('budget_cycles')
        .selectAll()
        .orderBy('fiscal_year', 'desc')
        .execute()
}

export async function getBudgetCycleByYear(fiscalYear: number): Promise<BudgetCycle | null> {
    return await db
        .selectFrom('budget_cycles')
        .selectAll()
        .where('fiscal_year', '=', fiscalYear)
        .executeTakeFirst() ?? null
}

export async function getActiveBudgetCycle(): Promise<BudgetCycle | null> {
    return await db
        .selectFrom('budget_cycles')
        .selectAll()
        .where('prep_status', '=', 'active')
        .orderBy('fiscal_year', 'desc')
        .executeTakeFirst() ?? null
}

export async function createBudgetCycle(values: NewBudgetCycle): Promise<BudgetCycle> {
    return await db
        .insertInto('budget_cycles')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function updateBudgetCycle(fiscalYear: number, values: BudgetCycleUpdate): Promise<void> {
    await db
        .updateTable('budget_cycles')
        .set({
            ...values,
            updated_at: sql`now()`,
        })
        .where('fiscal_year', '=', fiscalYear)
        .executeTakeFirstOrThrow()
}

export async function editBudgetCycle(
    fiscalYear: number,
    nextStatus: BudgetCycle['prep_status'],
    nextPhase: BudgetCycle['current_phase'],
    changedBy: string,
    legalBasisRef?: string | null
): Promise<BudgetCycle> {
    return await db.transaction().execute(async (trx) => {
        const existingCycle = await trx
            .selectFrom('budget_cycles')
            .selectAll()
            .where('fiscal_year', '=', fiscalYear)
            .executeTakeFirst()

        if (!existingCycle) {
            throw new Error(`Fiscal year ${fiscalYear} does not exist.`)
        }

        const normalizedState = normalizeCycleState(nextStatus, nextPhase)

        if (normalizedState.prep_status === 'active') {
            const activeCycle = await trx
                .selectFrom('budget_cycles')
                .selectAll()
                .where('prep_status', '=', 'active')
                .executeTakeFirst()

            if (activeCycle && activeCycle.fiscal_year !== fiscalYear) {
                throw new Error(`Fiscal year ${activeCycle.fiscal_year} is already active.`)
            }
        }

        return await trx
            .updateTable('budget_cycles')
            .set({
                prep_status: normalizedState.prep_status,
                current_phase: normalizedState.current_phase,
                prep_opened_at: normalizedState.prep_status === 'active'
                    ? new Date()
                    : existingCycle.prep_opened_at,
                prep_locked_at: normalizedState.prep_status === 'locked'
                    ? new Date()
                    : normalizedState.prep_status === 'active'
                        ? null
                        : existingCycle.prep_locked_at,
                status_changed_by: changedBy,
                legal_basis_ref: legalBasisRef ?? null,
                updated_at: sql`now()`,
            })
            .where('fiscal_year', '=', fiscalYear)
            .returningAll()
            .executeTakeFirstOrThrow()
    })
}

export async function startBudgetCycle(fiscalYear: number, changedBy: string, legalBasisRef?: string | null): Promise<BudgetCycle> {
    return await db.transaction().execute(async (trx) => {
        const activeCycle = await trx
            .selectFrom('budget_cycles')
            .selectAll()
            .where('prep_status', '=', 'active')
            .executeTakeFirst()

        if (activeCycle && activeCycle.fiscal_year !== fiscalYear) {
            throw new Error(`Fiscal year ${activeCycle.fiscal_year} is already active.`)
        }

        const existingCycle = await trx
            .selectFrom('budget_cycles')
            .selectAll()
            .where('fiscal_year', '=', fiscalYear)
            .executeTakeFirst()

        if (existingCycle?.prep_status === 'locked') {
            throw new Error(`Fiscal year ${fiscalYear} is already locked.`)
        }

        if (existingCycle?.prep_status === 'active') {
            throw new Error(`Fiscal year ${fiscalYear} is already active.`)
        }

        if (existingCycle?.prep_status === 'closed') {
            return await trx
                .updateTable('budget_cycles')
                .set({
                    prep_status: 'active',
                    current_phase: 'preparation',
                    prep_opened_at: new Date(),
                    prep_locked_at: null,
                    status_changed_by: changedBy,
                    legal_basis_ref: legalBasisRef ?? existingCycle.legal_basis_ref,
                    updated_at: sql`now()`,
                })
                .where('fiscal_year', '=', fiscalYear)
                .returningAll()
                .executeTakeFirstOrThrow()
        }

        return await trx
            .insertInto('budget_cycles')
            .values({
                fiscal_year: fiscalYear,
                prep_status: 'active',
                current_phase: 'preparation',
                prep_opened_at: new Date(),
                prep_locked_at: null,
                status_changed_by: changedBy,
                legal_basis_ref: legalBasisRef ?? null,
            })
            .returningAll()
            .executeTakeFirstOrThrow()
    })
}

export async function lockActiveBudgetCycle(changedBy: string): Promise<BudgetCycle> {
    return await db.transaction().execute(async (trx) => {
        const activeCycle = await trx
            .selectFrom('budget_cycles')
            .selectAll()
            .where('prep_status', '=', 'active')
            .executeTakeFirst()

        if (!activeCycle) {
            throw new Error('There is no active budget cycle to lock.')
        }

        return await trx
            .updateTable('budget_cycles')
            .set({
                prep_status: 'locked',
                current_phase: 'enacted_gaa',
                prep_locked_at: new Date(),
                status_changed_by: changedBy,
                updated_at: sql`now()`,
            })
            .where('fiscal_year', '=', activeCycle.fiscal_year)
            .returningAll()
            .executeTakeFirstOrThrow()
    })
}
