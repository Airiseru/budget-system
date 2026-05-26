'use client'

import type { BudgetCycle } from '@/src/types/budget_settings'
import type {
    AllocationDashboardRow,
    AllocationDashboardTotals,
    AllocationHierarchySummaryRow,
} from '@/src/db/postgres/repositories/budgetAllocationRepository'
import type { Department } from '@/src/types/entities'
import type { PapOption } from '@/src/db/postgres/repositories/papRepository'
import type { ItemCatalogOption } from '@/src/db/postgres/repositories/itemRepository'
import type { SearchableComboboxOption } from '@/components/ui/dbm/SearchableComboboxField'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export type EntityOption = {
    id: string
    entity_type: string
    name: string
    abbr: string | null
    uacs_code: string
    department_id?: string | null
    agency_id?: string | null
    parent_ou_id?: string | null
}

export type FundingSourceOption = {
    code: string
    description: string | null
}

export type SignoffData = {
    formId: string
    entityId: string
    authStatus: string
    signatoryRole: string
    userId: string
    fiscalYear: number
    signoffType: 'nep' | 'gaa'
    codename: string
    formData: object
    signatories: {
        id: string
        user_name: string
        role: string
        created_at: Date
    }[]
    alreadySigned: boolean
    userCanSign: boolean
    missingValidityCount: number
}

export type AllocationDashboardProps = {
    activeCycle: BudgetCycle | null
    viewingYear: number | null
    availableYears: number[]
    yearLockedToActivePreparation: boolean
    rows: AllocationDashboardRow[]
    overallTotals: AllocationDashboardTotals
    filteredTotals: AllocationDashboardTotals
    hierarchySummaries: AllocationHierarchySummaryRow[]
    departments: Department[]
    paps: PapOption[]
    entities: EntityOption[]
    items: ItemCatalogOption[]
    fundingSources: FundingSourceOption[]
    page: number
    totalPages: number
    selectedDepartmentId: string
    selectedPapId: string
    selectedExpenseClass: string
    search: string
    includeDbmRejectedLineItems: boolean
    isFiltered: boolean
    signoff: SignoffData | null
}

export type LegislativeInsertionState = {
    entity_id: string
    pap_code: string
    item_catalog_id: string
    fund_code: string
    tier: '1' | '2'
    specific_description: string
    currency: string
    gaa_amt: string
    release_classification: 'FLR' | 'FCR'
    valid_from: string
    valid_until: string
}

export type BulkValidityState = {
    scope: 'all' | 'expense_class' | 'tier' | 'expense_class_and_tier'
    expense_class: string
    tier: '1' | '2'
    valid_from: string
    valid_until: string
}

export const initialInsertionState: LegislativeInsertionState = {
    entity_id: '',
    pap_code: '',
    item_catalog_id: '',
    fund_code: '',
    tier: '1',
    specific_description: '',
    currency: 'PHP',
    gaa_amt: '0',
    release_classification: 'FLR',
    valid_from: '',
    valid_until: '',
}

export const initialBulkValidityState: BulkValidityState = {
    scope: 'all',
    expense_class: '',
    tier: '1',
    valid_from: '',
    valid_until: '',
}

export const formatAmount = (value: number) =>
    Number(value ?? 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })

export const getChangeTone = (percentChange: number) => {
    const magnitude = Math.abs(percentChange)
    if (magnitude >= 50) return 'font-bold'
    if (magnitude >= 15) return 'font-semibold'
    return ''
}

export function getEntityLabel(entity: EntityOption) {
    return `${entity.uacs_code} • ${entity.name}`
}

export function getInputKey(allocationId: string, field: string) {
    return `${allocationId}-${field}`
}

export function getColumnCount(phase: BudgetCycle['current_phase'] | null) {
    if (phase === 'dbm_review') return 10
    if (phase === 'presidential_approval') return 10
    if (phase === 'legislative_deliberation') return 12
    return 12
}

export function getNumericInputValue(
    inputValues: Record<string, string>,
    row: AllocationDashboardRow,
    field: 'dbm_rec_amt' | 'nep_amt' | 'gaa_amt'
) {
    const raw = inputValues[getInputKey(row.id, field)]
    if (raw === undefined || raw.trim() === '') {
        return Number(row[field] ?? 0)
    }

    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : Number(row[field] ?? 0)
}

export function buildOrderedEntities(entities: EntityOption[]) {
    const departments = entities
        .filter((entity) => entity.entity_type === 'department')
        .sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))
    const agencies = entities
        .filter((entity) => entity.entity_type === 'agency')
        .sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))
    const operatingUnits = entities
        .filter((entity) => entity.entity_type === 'operating_unit')
        .sort((a, b) => a.uacs_code.localeCompare(b.uacs_code))

    const ordered: EntityOption[] = []
    const pushOperatingUnits = (parentAgencyId: string, parentOuId: string | null = null) => {
        const matches = operatingUnits.filter((entity) =>
            entity.agency_id === parentAgencyId && (entity.parent_ou_id ?? null) === parentOuId
        )

        for (const entity of matches) {
            ordered.push(entity)
            pushOperatingUnits(parentAgencyId, entity.id)
        }
    }

    for (const department of departments) {
        ordered.push(department)
        const departmentAgencies = agencies.filter((agency) => agency.department_id === department.id)
        for (const agency of departmentAgencies) {
            ordered.push(agency)
            pushOperatingUnits(agency.id)
        }
    }

    const independentAgencies = agencies.filter((agency) => !agency.department_id)
    for (const agency of independentAgencies) {
        ordered.push(agency)
        pushOperatingUnits(agency.id)
    }

    return ordered
}

export function buildEntityComboboxOptions(entities: EntityOption[]): SearchableComboboxOption[] {
    const orderedOptions: SearchableComboboxOption[] = []
    const orderedEntities = buildOrderedEntities(entities)
    const entityById = new Map(entities.map((entity) => [entity.id, entity]))

    const getAncestors = (entity: EntityOption) => {
        const ancestors: EntityOption[] = []

        if (entity.entity_type === 'agency' && entity.department_id) {
            const department = entityById.get(entity.department_id)
            if (department) ancestors.push(department)
        }

        if (entity.entity_type === 'operating_unit') {
            const agency = entity.agency_id ? entityById.get(entity.agency_id) : null
            const departmentId = entity.department_id ?? agency?.department_id ?? null

            if (departmentId) {
                const department = entityById.get(departmentId)
                if (department) ancestors.push(department)
            }

            if (agency) ancestors.push(agency)

            let parentOuId = entity.parent_ou_id ?? null
            const parentOperatingUnits: EntityOption[] = []
            while (parentOuId) {
                const parent = entityById.get(parentOuId)
                if (!parent) break
                parentOperatingUnits.unshift(parent)
                parentOuId = parent.parent_ou_id ?? null
            }
            ancestors.push(...parentOperatingUnits)
        }

        return ancestors
    }

    for (const entity of orderedEntities) {
        const ancestors = getAncestors(entity)
        const searchText = [...ancestors, entity]
            .flatMap((item) => [item.name, item.uacs_code])
            .filter(Boolean)
            .join(' ')

        orderedOptions.push({
            value: entity.id,
            label: getEntityLabel(entity),
            searchText,
            indentLevel: ancestors.length,
        })
    }

    return orderedOptions
}

export function getAllocationGroupKey(row: AllocationDashboardRow) {
    return [
        row.department_id ?? 'none',
        row.agency_id ?? 'none',
        row.operating_unit_id ?? 'none',
        row.pap_project_type ?? 'none',
        row.pap_title ?? 'No PAP',
    ].join('|')
}

export function formatDateTime(dateLike: Date | string) {
    return new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(dateLike))
}
