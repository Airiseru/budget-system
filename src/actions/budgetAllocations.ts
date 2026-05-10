'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireDbm } from './admin'
import { sessionDetails } from './auth'
import {
    createBudgetAllocationRepository,
    createBudgetSettingsRepository,
    createEntityRepository,
    createItemRepository,
    createPapRepository,
    createUacsRepository,
} from '../db/factory'
import {
    AllocationRemarkFormState,
    AllocationRemarkSchema,
    TierOneAllocationFormState,
    TierOneAllocationSchema,
} from '../lib/validations/budgetAllocations'
import type { BUDGET_PREP_WORKFLOW_STAGES_TYPE } from '../lib/constants'
import type { BudgetCyclePhase } from '../types/budget_settings'

const BudgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
const ItemRepository = createItemRepository(process.env.DATABASE_TYPE || 'postgres')
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')
const UacsRepository = createUacsRepository(process.env.DATABASE_TYPE || 'postgres')
const VIEW_PAGE_SIZE = 15
type EntityFilterMode = 'exact' | 'hierarchical'

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

function flattenRemarkState(error: z.ZodError, values: Record<string, string | undefined>): AllocationRemarkFormState {
    return {
        ...z.flattenError(error),
        values,
    }
}

const DBM_REVIEW_STAGE: BUDGET_PREP_WORKFLOW_STAGES_TYPE = 'dbm_review'

function toAmountDiffers(currentValue: number | string | null | undefined, nextValue: number) {
    return Number(currentValue ?? 0) !== Number(nextValue)
}

function getPhaseRestrictionMessage(phase: BudgetCyclePhase) {
    switch (phase) {
        case 'preparation':
            return 'Only the proposed amount and DBM recommended amount may be changed during the preparation phase.'
        case 'dbm_review':
            return 'Only the proposed amount and DBM recommended amount may be changed during DBM review.'
        case 'presidential_approval':
            return 'Only the NEP amount may be changed during presidential approval.'
        case 'legislative_deliberation':
            return 'Only the GAA amount may be changed during legislative deliberation.'
        case 'enacted_gaa':
            return 'This budget cycle is already enacted. Allocation updates are locked unless routed through an administrative override.'
    }
}

function validateAmountChangesForPhase(
    phase: BudgetCyclePhase,
    nextValues: {
        proposed_amt: number
        dbm_rec_amt: number
        nep_amt: number
        gaa_amt: number
    },
    existing?: {
        proposed_amt: number
        dbm_rec_amt: number
        nep_amt: number
        gaa_amt: number
    } | null
) {
    const proposedChanged = existing
        ? toAmountDiffers(existing.proposed_amt, nextValues.proposed_amt)
        : nextValues.proposed_amt !== 0
    const dbmChanged = existing
        ? toAmountDiffers(existing.dbm_rec_amt, nextValues.dbm_rec_amt)
        : nextValues.dbm_rec_amt !== 0
    const nepChanged = existing
        ? toAmountDiffers(existing.nep_amt, nextValues.nep_amt)
        : nextValues.nep_amt !== 0
    const gaaChanged = existing
        ? toAmountDiffers(existing.gaa_amt, nextValues.gaa_amt)
        : nextValues.gaa_amt !== 0

    if (phase === 'preparation') {
        return !nepChanged && !gaaChanged
    }

    if (phase === 'dbm_review') {
        return !nepChanged && !gaaChanged
    }

    if (phase === 'presidential_approval') {
        return !proposedChanged && !dbmChanged && !gaaChanged
    }

    if (phase === 'legislative_deliberation') {
        return !proposedChanged && !dbmChanged && !nepChanged
    }

    return false
}

async function getTierOneEntityFilterIds(
    entityId: string | undefined,
    entityFilterMode: EntityFilterMode
) {
    if (!entityId) return undefined
    if (entityFilterMode === 'exact') return [entityId]

    const entity = await EntityRepository.getEntityById(entityId).catch(() => null)
    if (!entity) return [entityId]

    if (entity.type === 'department') {
        const agencies = await EntityRepository.getAllAgenciesByDepartmentId(entityId)
        const agencyIds = agencies.map((agency) => agency.id)
        const operatingUnits = await Promise.all(
            agencyIds.map((agencyId) => EntityRepository.getAllOperatingUnitsByAgencyId(agencyId))
        )

        return [
            entityId,
            ...agencyIds,
            ...operatingUnits.flat().map((operatingUnit) => operatingUnit.id),
        ]
    }

    if (entity.type === 'agency') {
        const operatingUnits = await EntityRepository.getAllOperatingUnitsByAgencyId(entityId)
        return [entityId, ...operatingUnits.map((operatingUnit) => operatingUnit.id)]
    }

    if (entity.type === 'operating_unit') {
        const descendants = await EntityRepository.getOperatingUnitDescendantIds(entityId)
        return [entityId, ...descendants]
    }

    return [entityId]
}

function getTierOnePapFilterIds(
    paps: Awaited<ReturnType<typeof PapRepository.getPapOptions>>,
    papCode: string | undefined,
    entityFilterMode: EntityFilterMode,
    entityIds?: string[]
) {
    if (!papCode) return undefined
    if (entityFilterMode === 'exact' || !entityIds?.length) return [papCode]

    const selectedPap = paps.find((pap) => pap.id === papCode)
    if (!selectedPap) return [papCode]

    return paps
        .filter((pap) =>
            pap.title === selectedPap.title &&
            (pap.entity_id === null || entityIds.includes(pap.entity_id))
        )
        .map((pap) => pap.id)
}

export async function loadTierOneDashboard() {
    await requireDbm()

    const activeCycle = await BudgetSettingsRepository.getActiveBudgetCycle()
    const cycles = await BudgetSettingsRepository.listBudgetCycles()
    const fallbackYear = cycles[0]?.fiscal_year ?? null

    return await loadTierOneDashboardForYear({
        selectedYear: activeCycle?.fiscal_year ?? fallbackYear,
    })
}

export async function loadTierOneDashboardForYear({
    selectedYear,
    selectedEntityId,
    selectedEntityMode = 'exact',
    selectedPapCode,
    page = 1,
}: {
    selectedYear?: number | null
    selectedEntityId?: string
    selectedEntityMode?: EntityFilterMode
    selectedPapCode?: string
    page?: number
}) {
    await requireDbm()

    const activeCycle = await BudgetSettingsRepository.getActiveBudgetCycle()
    const cycles = await BudgetSettingsRepository.listBudgetCycles()
    const viewingYear = activeCycle?.fiscal_year ?? selectedYear ?? cycles[0]?.fiscal_year ?? null
    const isViewingOnly = !activeCycle || !['preparation', 'dbm_review'].includes(activeCycle.current_phase)
    const safePage = Number.isFinite(page) && page > 0 ? page : 1
    const entityIds = await getTierOneEntityFilterIds(selectedEntityId, selectedEntityMode)
    const [entitySegments, paps, items, fundingSources] = await Promise.all([
        EntityRepository.getAllEntitySegments(true),
        PapRepository.getPapOptions(),
        ItemRepository.listAllItemCatalog(),
        UacsRepository.listFundingSources(),
    ])
    const papCodes = getTierOnePapFilterIds(paps, selectedPapCode, selectedEntityMode, entityIds)
    const totalCount = viewingYear
        ? await BudgetAllocationRepository.countBudgetAllocationsByYear({
            year: viewingYear,
            tier: 1,
            entityId: selectedEntityId,
            entityIds,
            papCode: selectedPapCode,
            papCodes,
        })
        : 0
    const totalPages = viewingYear ? Math.max(1, Math.ceil(Number(totalCount) / VIEW_PAGE_SIZE)) : 1
    const currentPage = Math.min(safePage, totalPages)
    const offset = (currentPage - 1) * VIEW_PAGE_SIZE
    const allocations = viewingYear
        ? await BudgetAllocationRepository.listBudgetAllocationsByYear({
            year: viewingYear,
            tier: 1,
            entityId: selectedEntityId,
            entityIds,
            papCode: selectedPapCode,
            papCodes,
            limit: VIEW_PAGE_SIZE,
            offset,
        })
        : []

    return {
        activeCycle,
        viewingYear,
        availableYears: cycles.map((cycle) => cycle.fiscal_year),
        isViewingOnly,
        page: currentPage,
        totalPages,
        selectedEntityId: selectedEntityId ?? '',
        selectedEntityMode,
        selectedPapCode: selectedPapCode ?? '',
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

    const [dashboard, allocation, remarks] = await Promise.all([
        loadTierOneDashboard(),
        BudgetAllocationRepository.getBudgetAllocationById(id),
        BudgetAllocationRepository.listAllocationWorkflowLogs(id),
    ])

    if (!allocation) return null

    return {
        ...dashboard,
        allocation,
        remarks,
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

    if (!['preparation', 'dbm_review'].includes(activeCycle.current_phase)) {
        return {
            formErrors: [getPhaseRestrictionMessage(activeCycle.current_phase)],
        }
    }

    const values = {
        entity_id: emptyToUndefined(formData.get('entity_id')) ?? '',
        pap_code: emptyToUndefined(formData.get('pap_code')) ?? '',
        item_catalog_id: emptyToUndefined(formData.get('item_catalog_id')) ?? '',
        fund_code: emptyToUndefined(formData.get('fund_code')) ?? '',
        workflow_stage: emptyToUndefined(formData.get('workflow_stage')) ?? DBM_REVIEW_STAGE,
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

    if (!validateAmountChangesForPhase(activeCycle.current_phase, parsed.data)) {
        return {
            formErrors: [getPhaseRestrictionMessage(activeCycle.current_phase)],
            values,
        }
    }

    try {
        const created = await BudgetAllocationRepository.createBudgetAllocation({
            entity_id: parsed.data.entity_id,
            budget_cycle_year: activeCycle.fiscal_year,
            pap_code: parsed.data.pap_code,
            fund_code: parsed.data.fund_code,
            item_catalog_id: parsed.data.item_catalog_id,
            tier: 1,
            specific_description: parsed.data.specific_description,
            quantity: parsed.data.quantity,
            currency: parsed.data.currency,
            release_classification: 'unclassified',
            origin_tag: 'dbm_insertion',
            proposed_amt: parsed.data.proposed_amt,
            dbm_rec_amt: parsed.data.dbm_rec_amt,
            nep_amt: parsed.data.nep_amt,
            gaa_amt: parsed.data.gaa_amt,
            valid_from: parsed.data.valid_from ? new Date(parsed.data.valid_from) : null,
            valid_until: parsed.data.valid_until ? new Date(parsed.data.valid_until) : null,
            auth_status: 'draft',
        })

        const remarks = emptyToUndefined(formData.get('remarks'))
        const parsedRemarks = remarks
            ? AllocationRemarkSchema.safeParse({
                workflow_stage: values.workflow_stage,
                remarks,
            })
            : null
        if (parsedRemarks && !parsedRemarks.success) {
            return {
                formErrors: parsedRemarks.error.flatten().formErrors,
                fieldErrors: parsedRemarks.error.flatten().fieldErrors,
                values,
            }
        }
        const session = await sessionDetails()
        if (parsedRemarks?.success && session?.user?.id) {
            await BudgetAllocationRepository.createAllocationWorkflowLog({
                allocation_id: created.id,
                workflow_stage: parsedRemarks.data.workflow_stage,
                remarks: parsedRemarks.data.remarks,
                amt_before: null,
                amt_after: parsed.data.dbm_rec_amt,
                performed_by: session.user.id,
            })
        }
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
        workflow_stage: emptyToUndefined(formData.get('workflow_stage')) ?? DBM_REVIEW_STAGE,
        specific_description: emptyToUndefined(formData.get('specific_description')) ?? '',
        remarks: emptyToUndefined(formData.get('remarks')) ?? '',
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

    const parsedRemarks = AllocationRemarkSchema.safeParse({
        workflow_stage: values.workflow_stage,
        remarks: values.remarks,
    })
    if (!parsedRemarks.success) {
        return {
            formErrors: parsedRemarks.error.flatten().formErrors,
            fieldErrors: {
                remarks: parsedRemarks.error.flatten().fieldErrors.remarks,
            },
            values,
        }
    }

    try {
        const existing = await BudgetAllocationRepository.getBudgetAllocationById(id)
        if (!existing) {
            return {
                formErrors: ['Allocation not found.'],
                values,
            }
        }

        const cycle = await BudgetSettingsRepository.getBudgetCycleByYear(existing.budget_cycle_year)
        if (!cycle) {
            return {
                formErrors: ['Budget cycle not found for this allocation.'],
                values,
            }
        }

        if (cycle.current_phase === 'enacted_gaa' || cycle.prep_status === 'locked') {
            return {
                formErrors: [getPhaseRestrictionMessage('enacted_gaa')],
                values,
            }
        }

        if (!validateAmountChangesForPhase(cycle.current_phase, parsed.data, existing)) {
            return {
                formErrors: [getPhaseRestrictionMessage(cycle.current_phase)],
                values,
            }
        }

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

        const session = await sessionDetails()
        if (session?.user?.id) {
            await BudgetAllocationRepository.createAllocationWorkflowLog({
                allocation_id: id,
                workflow_stage: parsedRemarks.data.workflow_stage,
                remarks: parsedRemarks.data.remarks,
                amt_before: existing.dbm_rec_amt,
                amt_after: parsed.data.dbm_rec_amt,
                performed_by: session.user.id,
            })
        }
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to update Tier One allocation.'],
            values,
        }
    }

    revalidatePath('/dbm/tier-one')
    redirect('/dbm/tier-one')
}

export async function addTierOneAllocationRemarkAction(
    _state: AllocationRemarkFormState,
    formData: FormData
): Promise<AllocationRemarkFormState> {
    void _state
    await requireDbm()

    const allocationId = emptyToUndefined(formData.get('allocation_id'))
    const values = {
        workflow_stage: emptyToUndefined(formData.get('workflow_stage')) ?? DBM_REVIEW_STAGE,
        remarks: emptyToUndefined(formData.get('remarks')) ?? '',
    }

    if (!allocationId) {
        return {
            formErrors: ['Allocation ID is required.'],
            values,
        }
    }

    const parsed = AllocationRemarkSchema.safeParse(values)
    if (!parsed.success) {
        return flattenRemarkState(parsed.error, values)
    }

    const [session, allocation] = await Promise.all([
        sessionDetails(),
        BudgetAllocationRepository.getBudgetAllocationById(allocationId),
    ])

    if (!session?.user?.id || !allocation) {
        return {
            formErrors: ['Unable to add remarks for this allocation.'],
            values,
        }
    }

    try {
            await BudgetAllocationRepository.createAllocationWorkflowLog({
                allocation_id: allocationId,
                workflow_stage: parsed.data.workflow_stage,
                remarks: parsed.data.remarks,
                amt_before: allocation.dbm_rec_amt,
                amt_after: allocation.dbm_rec_amt,
            performed_by: session.user.id,
        })
    } catch (error) {
        return {
            formErrors: [error instanceof Error ? error.message : 'Failed to add remarks.'],
            values,
        }
    }

    revalidatePath(`/dbm/tier-one/${allocationId}/edit`)
    redirect(`/dbm/tier-one/${allocationId}/edit`)
}
