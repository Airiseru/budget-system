import { ItemCatalogScope } from "../types/line_items"

export const ENTITY_TYPE_LABELS: Record<string, string> = {
    department: 'Department',
    agency: 'Agency',
    operating_unit: 'Operating Unit',
}

export type UACS_CATEOGIRES = 'funding_source' | 'location' | 'object_code'

export const VALID_UACS_CATEGORIES: UACS_CATEOGIRES[] = ['funding_source', 'location', 'object_code']

export const FORM_TYPES: Record<string, string> = {
    all: 'All',
    bp_staffing: 'BP Form 204',
    bp_retiree: 'BP Form 205',
    bp_local_proposal_new: 'BP Form 202 (New)',
    bp_local_proposal_expanded: 'BP Form 202 (Expanded)',
    bp_foreign_proposal_new: 'BP Form 203 (New)',
    bp_foreign_proposal_expanded: 'BP Form 203 (Expanded)',
    nep: 'National Expenditure Program',
    gaa: 'General Appropriations Act',
}

export const FORM_ROUTE_MAP: Record<string, string> = {
    'bp_staffing': '/forms/staff',
    'bp_retiree': '/forms/retirees',
    'bp_local_proposal_new': '/forms/proposals',
    'bp_local_proposal_expanded': '/forms/proposals',
    'bp_foreign_proposal_new': '/forms/proposals',
    'bp_foreign_proposal_expanded': '/forms/proposals',
    'nep': '/dbm/allocations',
    'gaa': '/dbm/allocations',
}

export const FORM_NAMES: Record<string, string> = {
    bp_staffing: 'Staffing Summary',
    bp_retiree: 'List of Retirees',
    bp_local_proposal_new: 'New Local Proposal',
    bp_local_proposal_expanded: 'Expanded Local Proposal',
    bp_foreign_proposal_new: 'New Foreign Proposal',
    bp_foreign_proposal_expanded: 'Expanded Foreign Proposal',
    nep: 'NEP Sign-Off',
    gaa: 'GAA Sign-Off',
}

export const STATUS_LABELS: Record<string, string> = {
    none: 'All',
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
    pending_planning: 'Pending Planning Officer',
    pending_chief_accountant: 'Pending Chief Accountant',
    pending_office_head: 'Pending Office Head',
    pending_agency_head: 'Pending Agency Head',
    pending_dbm: 'Pending DBM',
    rejected: 'Rejected',
    approved: 'Approved',
}

export const WORKFLOW_ROLE_LABELS: Record<string, string> = {
    none: 'None / N/A',
    personnel_officer: 'Personnel Officer',
    budget_officer: 'Budget Officer',
    planning_officer: 'Planning Officer',
    chief_accountant: 'Chief Accountant',
    office_head: 'Office Head',
    agency_head: 'Agency Head',
    dbm: 'DBM',
}

export const STATUS_MESSAGES: Record<string, string> = {
    draft: 'This form is in draft.',
    pending_personnel: "Waiting for Personnel Officer's signature.",
    pending_budget: "Waiting for Budget Officer's signature.",
    pending_planning: "Waiting for Planning Officer's signature.",
    pending_chief_accountant: "Waiting for Chief Accountant's signature.",
    pending_office_head: "Waiting for Office Head's signature.",
    pending_agency_head: "Waiting for Agency Head's approval.",
    pending_dbm: "Waiting for DBM's approval.",
    approved: 'This form has been fully approved.',
    rejected: 'This form has been rejected.',
}

export const STATUS_BADGE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    pending_personnel: 'secondary',
    pending_budget: 'secondary',
    pending_planning: 'secondary',
    pending_chief_accountant: 'secondary',
    pending_office_head: 'secondary',
    pending_agency_head: 'secondary',
    pending_dbm: 'secondary',
    approved: 'default',
    rejected: 'destructive',
}

export const STATUS_COLOR_MAPPER = (status: string) => {
    switch (status) {
        case 'pending_dbm': return 'bg-accent-foreground/10 text-accent-foreground border-accent-foreground/30'
        case 'approved': return 'bg-secondary-foreground/10 text-secondary-foreground border-secondary-foreground/30'
        case 'rejected': return 'bg-destructive/10 text-destructive border-destructive/30'
        case 'draft': return 'bg-secondary/50 text-muted-foreground border-border/20'
        default: return 'bg-secondary/50 text-muted-foreground border-border/20'
    }
}

export const ROLE_LABELS: Record<string, string> = {
    dbm: 'DBM',
    department: 'Department',
    agency: 'Agency',
    ou: 'Operating Unit',
    others: 'Others',
}

export const ACCESS_LEVEL_LABELS: Record<string, string> = {
    none: 'None',
    view: 'Viewer',
    encode: 'Encoder',
    review: 'Reviewer',
    approve: 'Approver',
}

export const ACCESS_LEVELS_HIERARCHY = ['none', 'view', 'encode', 'review', 'approve']

export const TLB_FACTOR = 0.0481927

export const MAX_SG = 33
export const MAX_STEP = 8

export const VALID_COMPENSATION_NAMES = [
    'PERA', 'RATA', 'Clothing Allowance', 'Mid-Year Bonus',
    'Year-End Bonus', 'Cash Gift', 'PEI', 'RLIP',
    'Pag-IBIG', 'ECiP', 'PHIC', 'Medical Allowance',
    "Compensation Related Magna Carta Benefits"
]

export const EXPENSE_CLASSES: Record<string, string> = {
    "PS": "Personnel Services",
    "MOOE": "Maintenance and Other Operating Expenses",
    "CO": "Contractual Obligations",
    "FINEX": "Financial Expenses"
}

export const EXPENSE_CLASS_CODES: Record<string, string> = {
    "PS": "1",
    "MOOE": "2",
    "CO": "6",
    "FINEX": "3"
}

export const EXPENSE_CLASS_OPTIONS = Object.entries(EXPENSE_CLASSES).map(([value, label]) => ({
    value,
    label,
    code: EXPENSE_CLASS_CODES[value],
}))

export const ITEM_SCOPE_OPTIONS: { value: ItemCatalogScope; label: string }[] = [
    { value: 'global', label: 'Global' },
    { value: 'entity', label: 'Entity' },
    { value: 'pap', label: 'PAP' },
]

export const ITEM_EXPENSE_CLASS_OPTIONS = Object.entries(EXPENSE_CLASSES).map(([value, label]) => ({
    value,
    label,
    code: EXPENSE_CLASS_CODES[value],
}))

export type BUDGET_PREP_WORKFLOW_STAGES_TYPE = 'entity_proposal' | 'dbm_review' | 'dbm_appeal' | 'presidential_review' | 'congressional_bicam'
