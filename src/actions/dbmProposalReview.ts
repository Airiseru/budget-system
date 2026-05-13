'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireDbm } from './admin'
import { sessionDetails } from './auth'
import {
    createBudgetAllocationRepository,
    createBudgetSettingsRepository,
    createEntityRepository,
    createFormRepository,
    createItemRepository,
    createPapRepository,
    createProposalRepository,
    createUacsRepository,
} from '../db/factory'

const ProposalRepository = createProposalRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetAllocationRepository = createBudgetAllocationRepository(process.env.DATABASE_TYPE || 'postgres')
const BudgetSettingsRepository = createBudgetSettingsRepository(process.env.DATABASE_TYPE || 'postgres')
const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const ItemRepository = createItemRepository(process.env.DATABASE_TYPE || 'postgres')
const PapRepository = createPapRepository(process.env.DATABASE_TYPE || 'postgres')
const UacsRepository = createUacsRepository(process.env.DATABASE_TYPE || 'postgres')

const PAGE_SIZE = 20

const amountField = z.preprocess(
    (value) => Number(value),
    z.number().min(0, 'Recommended amount must be at least 0')
)

const AcceptProposalSchema = z.object({
    proposal_id: z.string().uuid(),
    pap_code: z.string().uuid('PREXC/PAP is required.'),
    default_fund_code: z.string().min(1, 'Fund source is required.'),
})

const RejectProposalSchema = z.object({
    proposal_id: z.string().uuid(),
})

const CompleteScopeSchema = z.object({
    fiscal_year: z.preprocess((value) => Number(value), z.number().int()),
    scope_type: z.enum(['department', 'agency', 'operating_unit']),
    scope_id: z.string().uuid(),
})

export async function loadDbmProposalReview(params: {
    year?: number
    status?: string
    departmentId?: string
    agencyId?: string
    operatingUnitId?: string
    search?: string
    page?: number
}) {
    await requireDbm()

    const [cycles, activeCycle, entitySegments, paps, itemCatalogs, fundingSources] = await Promise.all([
        BudgetSettingsRepository.listBudgetCycles(),
        BudgetSettingsRepository.getActiveBudgetCycle(),
        EntityRepository.getAllEntitySegments(true),
        PapRepository.getPapOptions(),
        ItemRepository.listAllItemCatalog(),
        UacsRepository.listFundingSources(),
    ])

    const viewingYear = params.year ?? activeCycle?.fiscal_year ?? cycles[0]?.fiscal_year
    const page = Math.max(1, params.page ?? 1)
    const filters = {
        fiscalYear: viewingYear,
        status: params.status || 'pending_dbm',
        departmentId: params.departmentId,
        agencyId: params.agencyId,
        operatingUnitId: params.operatingUnitId,
        search: params.search ?? '',
    }

    const [rows, totalCount] = await Promise.all([
        ProposalRepository.listDbmProposalReviewRows({
            ...filters,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
        }),
        ProposalRepository.countDbmProposalReviewRows(filters),
    ])

    return {
        rows,
        totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
        page,
        viewingYear,
        availableYears: cycles.map((cycle) => cycle.fiscal_year),
        selectedStatus: filters.status,
        selectedDepartmentId: params.departmentId ?? 'all',
        selectedAgencyId: params.agencyId ?? 'all',
        selectedOperatingUnitId: params.operatingUnitId ?? 'all',
        search: filters.search,
        departments: entitySegments.departments,
        agencies: entitySegments.agencies,
        operatingUnits: entitySegments.operatingUnits,
        paps,
        itemCatalogs,
        fundingSources,
    }
}

export async function acceptProposalAction(formData: FormData) {
    await requireDbm()
    const values = {
        proposal_id: formData.get('proposal_id'),
        pap_code: formData.get('pap_code'),
        default_fund_code: formData.get('default_fund_code'),
    }
    const parsed = AcceptProposalSchema.safeParse(values)
    if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid proposal acceptance.')
    }

    const proposal = await ProposalRepository.getProjectProposalById(parsed.data.proposal_id)
    if (!proposal) throw new Error('Proposal not found.')
    if (proposal.auth_status !== 'pending_dbm') {
        throw new Error('Only proposals pending DBM can be accepted.')
    }

    const session = await sessionDetails()
    if (!session?.user?.id) throw new Error('Missing user session.')

    for (const component of proposal.cost_by_components ?? []) {
        const componentId = String(component.id)
        const itemCatalogId = String(component.item_catalog_id ?? '')
        if (!itemCatalogId) continue

        const dbmRecAmt = amountField.parse(formData.get(`dbm_rec_amt_${componentId}`) ?? component.proposed_amt ?? 0)
        const fundCode = String(component.fund_code || parsed.data.default_fund_code)
        const proposedAmt = Number(component.proposed_amt ?? component.costs?.[0]?.amount ?? 0)
        const previousYearGaa = await BudgetAllocationRepository.findPreviousYearGaaAmount({
            fiscalYear: proposal.proposal_year,
            entityId: proposal.entity_id,
            papCode: parsed.data.pap_code,
            fundCode,
            tier: 2,
            itemCatalogId,
        })

        const allocation = await BudgetAllocationRepository.createBudgetAllocation({
            entity_id: proposal.entity_id,
            budget_cycle_year: proposal.proposal_year,
            pap_code: parsed.data.pap_code,
            fund_code: fundCode,
            item_catalog_id: itemCatalogId,
            tier: 2,
            specific_description: component.specific_description ?? null,
            currency: component.currency ?? 'PHP',
            release_classification: 'unclassified',
            origin_tag: 'agency_proposed',
            proposed_amt: proposedAmt,
            dbm_rec_amt: dbmRecAmt,
            nep_amt: 0,
            gaa_amt: 0,
            prev_year_gaa_amt: previousYearGaa,
            valid_from: null,
            valid_until: null,
            auth_status: 'proposed',
        })

        await BudgetAllocationRepository.createAllocationWorkflowLog({
            allocation_id: allocation.id,
            workflow_stage: 'dbm_review',
            remarks: `Accepted project proposal "${proposal.title}".`,
            amt_before: null,
            amt_after: dbmRecAmt,
            performed_by: session.user.id,
        })
    }

    await FormRepository.updateFormAuthStatus(parsed.data.proposal_id, 'approved')
    revalidatePath('/dbm/proposals')
    revalidatePath('/dbm/allocations')
}

export async function rejectProposalAction(formData: FormData) {
    await requireDbm()
    const parsed = RejectProposalSchema.parse({
        proposal_id: formData.get('proposal_id'),
    })
    await FormRepository.updateFormAuthStatus(parsed.proposal_id, 'rejected')
    revalidatePath('/dbm/proposals')
}

export async function completeProposalScopeAction(formData: FormData) {
    await requireDbm()
    const parsed = CompleteScopeSchema.parse({
        fiscal_year: formData.get('fiscal_year'),
        scope_type: formData.get('scope_type'),
        scope_id: formData.get('scope_id'),
    })

    const rejectedCount = await ProposalRepository.updatePendingDbmProposalScopesToRejected({
        fiscalYear: parsed.fiscal_year,
        departmentId: parsed.scope_type === 'department' ? parsed.scope_id : undefined,
        agencyId: parsed.scope_type === 'agency' ? parsed.scope_id : undefined,
        operatingUnitId: parsed.scope_type === 'operating_unit' ? parsed.scope_id : undefined,
    })

    void rejectedCount
    revalidatePath('/dbm/proposals')
}
