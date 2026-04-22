export const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
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

export const ROLE_LABELS: Record<string, string> = {
    agency: 'Agency',
    dbm: 'DBM',
    admin: 'Administrator',
}

export const ACCESS_LEVEL_LABELS: Record<string, string> = {
    view: 'Viewer',
    encode: 'Encoder',
    review: 'Reviewer',
    approve: 'Approver',
}

export const TLB_FACTOR = 0.0481927

export const MAX_SG = 33
export const MAX_STEP = 8

export const VALID_COMPENSATION_NAMES = [
    'PERA', 'RATA', 'Clothing Allowance', 'Mid-Year Bonus',
    'Year-End Bonus', 'Cash Gift', 'PEI', 'RLIP',
    'Pag-IBIG', 'ECiP', 'PHIC', 'Medical Allowance',
    "Compensation Related Magna Carta Benefits"
]