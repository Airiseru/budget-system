'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireDbm } from './admin'
import {
    createBudgetAllocationRepository,
    createBudgetSettingsRepository,
    createEntityRepository,
    createItemRepository,
    createPapRepository,
    createUacsRepository,
} from '../db/factory'
import { TierOneAllocationFormState, TierOneAllocationSchema } from '../lib/validations/budgetAllocations'

const BudgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
const ItemRepository = createItemRepository(process.env.DATABASE_TYPE || 'postgres')
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')
const UacsRepository = createUacsRepository(process.env.DATABASE_TYPE || 'postgres')

const emptyToUndefined = (value: FormDataEntryValue | null) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed === '' ? undefined : trimmed
}

function flattenState(error: z.ZodError, values: Record<string, string | undefined>): TierOneAllocationFormState {
    return {
        ...z.flattenError(error),
        values,
    }
}

export async function loadTierOneDashboard() {
    await requireDbm()

    const activeCycle = await BudgetSettingsRepository.getActiveBudgetCycle()
    const cycles = await BudgetSettingsRepository.listBudgetCycles()
    const fallbackYear = cycles[0]?.fiscal_year ?? null

    return await loadTierOneDashboardForYear(activeCycle?.fiscal_year ?? fallbackYear)
}

export async function loadTierOneDashboardForYear(selectedYear?: number | null) {
    await requireDbm()

    const activeCycle = await BudgetSettingsRepository.getActiveBudgetCycle()
    const cycles = await BudgetSettingsRepository.listBudgetCycles()
    const viewingYear = activeCycle?.fiscal_year ?? selectedYear ?? cycles[0]?.fiscal_year ?? null

    const [entitySegments, paps, items, fundingSources, allocations] = await Promise.all([
        EntityRepository.getAllEntitySegments(true),
        PapRepository.getPapOptions(),
        ItemRepository.listAllItemCatalog(),
        UacsRepository.listFundingSources(),
        viewingYear
            ? BudgetAllocationRepository.listBudgetAllocationsByYear(viewingYear, 1)
            : Promise.resolve([]),
    ])

    return {
        activeCycle,
        viewingYear,
        availableYears: cycles.map((cycle) => cycle.fiscal_year),
        isViewingOnly: !activeCycle,
        entities: [
            ...entitySegments.departments,
            ...entitySegments.agencies,
            ...entitySegments.operatingUnits,
        ],
        paps,
        items,
        fundingSources: fundingSources.filter((source) => source.status === 'active'),
        allocations,
    }
}

export async function loadTierOneAllocation(id: string) {
    await requireDbm()

    const [dashboard, allocation] = await Promise.all([
        loadTierOneDashboard(),
        BudgetAllocationRepository.getBudgetAllocationById(id),
    ])

    if (!allocation) return null

    return {
        ...dashboard,
        allocation,
    }
}

export async function createTierOneAllocationAction(
    _state: TierOneAllocationFormState,
    formData: FormData
): Promise<TierOneAllocationFormState> {
    void _state
    await requireDbm()

    const activeCycle = await BudgetSettingsRepository.getActiveBudgetCycle()
    if (!activeCycle) {
        return {
            formErrors: ['There is no active budget cycle. Start one before creating Tier One allocations.'],
        }
    }

    const values = {
        entity_id: emptyToUndefined(formData.get('entity_id')) ?? '',
        pap_code: emptyToUndefined(formData.get('pap_code')) ?? '',
        item_catalog_id: emptyToUndefined(formData.get('item_catalog_id')) ?? '',
        fund_code: emptyToUndefined(formData.get('fund_code')) ?? '',
        specific_description: emptyToUndefined(formData.get('specific_description')) ?? '',
        quantity: emptyToUndefined(formData.get('quantity')) ?? '',
        currency: emptyToUndefined(formData.get('currency')) ?? 'PHP',
        proposed_amt: emptyToUndefined(formData.get('proposed_amt')) ?? '0',
        dbm_rec_amt: emptyToUndefined(formData.get('dbm_rec_amt')) ?? '0',
        nep_amt: emptyToUndefined(formData.get('nep_amt')) ?? '0',
        gaa_amt: emptyToUndefined(formData.get('gaa_amt')) ?? '0',
        valid_from: emptyToUndefined(formData.get('valid_from')) ?? '',
        valid_until: emptyToUndefined(formData.get('valid_until')) ?? '',
    }

    const parsed = TierOneAllocationSchema.safeParse(values)
    if (!parsed.success) {
        return flattenState(parsed.error, values)
    }

    try {
        await BudgetAllocationRepository.createBudgetAllocation({
            entity_id: parsed.data.entity_id,
            budget_cycle_year: activeCycle.fiscal_year,
            pap_code: parsed.data.pap_code,
            fund_code: parsed.data.fund_code,
            item_catalog_id: parsed.data.item_catalog_id,
            tier: 1,
            specific_description: parsed.data.specific_description,
            quantity: parsed.data.quantity,
            currency: parsed.data.currency,
            proposed_amt: parsed.data.proposed_amt,
            dbm_rec_amt: parsed.data.dbm_rec_amt,
            nep_amt: parsed.data.nep_amt,
            gaa_amt: parsed.data.gaa_amt,
            valid_from: parsed.data.valid_from ? new Date(parsed.data.valid_from) : null,
            valid_until: parsed.data.valid_until ? new Date(parsed.data.valid_until) : null,
            auth_status: 'draft',
        })
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to create Tier One allocation.'],
            values,
        }
    }

    revalidatePath('/dbm/tier-one')
    redirect('/dbm/tier-one')
}

export async function updateTierOneAllocationAction(
    _state: TierOneAllocationFormState,
    formData: FormData
): Promise<TierOneAllocationFormState> {
    void _state
    await requireDbm()

    const id = emptyToUndefined(formData.get('id'))
    if (!id) {
        return {
            formErrors: ['Allocation ID is required.'],
        }
    }

    const values = {
        entity_id: emptyToUndefined(formData.get('entity_id')) ?? '',
        pap_code: emptyToUndefined(formData.get('pap_code')) ?? '',
        item_catalog_id: emptyToUndefined(formData.get('item_catalog_id')) ?? '',
        fund_code: emptyToUndefined(formData.get('fund_code')) ?? '',
        specific_description: emptyToUndefined(formData.get('specific_description')) ?? '',
        quantity: emptyToUndefined(formData.get('quantity')) ?? '',
        currency: emptyToUndefined(formData.get('currency')) ?? 'PHP',
        proposed_amt: emptyToUndefined(formData.get('proposed_amt')) ?? '0',
        dbm_rec_amt: emptyToUndefined(formData.get('dbm_rec_amt')) ?? '0',
        nep_amt: emptyToUndefined(formData.get('nep_amt')) ?? '0',
        gaa_amt: emptyToUndefined(formData.get('gaa_amt')) ?? '0',
        valid_from: emptyToUndefined(formData.get('valid_from')) ?? '',
        valid_until: emptyToUndefined(formData.get('valid_until')) ?? '',
    }

    const parsed = TierOneAllocationSchema.safeParse(values)
    if (!parsed.success) {
        return flattenState(parsed.error, values)
    }

    try {
        await BudgetAllocationRepository.updateBudgetAllocation(id, {
            entity_id: parsed.data.entity_id,
            pap_code: parsed.data.pap_code,
            fund_code: parsed.data.fund_code,
            item_catalog_id: parsed.data.item_catalog_id,
            specific_description: parsed.data.specific_description,
            quantity: parsed.data.quantity,
            currency: parsed.data.currency,
            proposed_amt: parsed.data.proposed_amt,
            dbm_rec_amt: parsed.data.dbm_rec_amt,
            nep_amt: parsed.data.nep_amt,
            gaa_amt: parsed.data.gaa_amt,
            valid_from: parsed.data.valid_from ? new Date(parsed.data.valid_from) : null,
            valid_until: parsed.data.valid_until ? new Date(parsed.data.valid_until) : null,
        })
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to update Tier One allocation.'],
            values,
        }
    }

    revalidatePath('/dbm/tier-one')
    redirect('/dbm/tier-one')
}
