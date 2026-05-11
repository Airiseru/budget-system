'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { sessionDetails } from './auth'
import { createBudgetSettingsRepository, createBudgetAllocationRepository } from '../db/factory'
import { StartBudgetCycleSchema, EditBudgetCycleSchema, BudgetCycleFormState } from '../lib/validations/budgetSettings'

const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')

async function requireBudgetCycleManager() {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    const isAdmin = session.user.role === 'admin'
    const isDbmApprover = session.user.role === 'dbm' && session.user.access_level === 'approve'

    if (!isAdmin && !isDbmApprover) {
        redirect('/home')
    }

    return session
}

export async function loadBudgetCycles() {
    await requireBudgetCycleManager()

    const [cycles, activeCycle] = await Promise.all([
        BudgetSettingsRepository.listBudgetCycles(),
        BudgetSettingsRepository.getActiveBudgetCycle(),
    ])

    return { cycles, activeCycle }
}

export async function loadBudgetCycle(fiscalYear: number) {
    await requireBudgetCycleManager()
    return await BudgetSettingsRepository.getBudgetCycleByYear(fiscalYear)
}

export async function startBudgetCycleAction(
    state: BudgetCycleFormState,
    formData: FormData
): Promise<BudgetCycleFormState> {
    const session = await requireBudgetCycleManager()

    const fiscal_year = formData.get('fiscal_year') as string
    const legal_basis_ref = formData.get('legal_basis_ref') as string
    const values = {
        fiscal_year,
        legal_basis_ref,
    }

    const parsed = StartBudgetCycleSchema.safeParse(values)
    if (!parsed.success) {
        return {
            ...z.flattenError(parsed.error),
            values,
        }
    }

    try {
        await BudgetSettingsRepository.startBudgetCycle(
            parsed.data.fiscal_year,
            session.user.id,
            parsed.data.legal_basis_ref || null
        )
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to start budget cycle.'],
            values,
        }
    }

    revalidatePath('/dbm/settings/cycles')
    redirect('/dbm/settings/cycles')
}

export async function lockActiveBudgetCycleAction(
    _state: BudgetCycleFormState
): Promise<BudgetCycleFormState> {
    void _state
    const session = await requireBudgetCycleManager()

    try {
        await BudgetSettingsRepository.lockActiveBudgetCycle(session.user.id)
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to lock active budget cycle.'],
        }
    }

    revalidatePath('/dbm/settings/cycles')
    redirect('/dbm/settings/cycles')
}

export async function editBudgetCycleAction(
    state: BudgetCycleFormState,
    formData: FormData
): Promise<BudgetCycleFormState> {
    const session = await requireBudgetCycleManager()

    const values = {
        fiscal_year: String(formData.get('fiscal_year') ?? ''),
        prep_status: String(formData.get('prep_status') ?? ''),
        current_phase: String(formData.get('current_phase') ?? ''),
        legal_basis_ref: String(formData.get('legal_basis_ref') ?? ''),
    }

    const parsed = EditBudgetCycleSchema.safeParse(values)
    if (!parsed.success) {
        return {
            ...z.flattenError(parsed.error),
            values,
        }
    }

    try {
        await BudgetSettingsRepository.editBudgetCycle(
            parsed.data.fiscal_year,
            parsed.data.prep_status,
            parsed.data.current_phase,
            session.user.id,
            parsed.data.legal_basis_ref || null
        )

        if (
            parsed.data.prep_status === 'active' &&
            (parsed.data.current_phase === 'presidential_approval' ||
                parsed.data.current_phase === 'legislative_deliberation')
        ) {
            await BudgetAllocationRepository.seedAllocationPhaseDefaults(
                parsed.data.fiscal_year,
                parsed.data.current_phase
            )
        }
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to update budget cycle.'],
            values,
        }
    }

    revalidatePath('/dbm/settings/cycles')
    redirect('/dbm/settings/cycles')
}
