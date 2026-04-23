export const FORM_TYPES: Record<string, string> = {
    all: 'All',
    bp_staffing: 'BP Form 204',
    bp_retiree: 'BP Form 205',
}

export const FORM_NAMES: Record<string, string> = {
    bp_staffing: 'Staffing Summary',
    bp_retiree: 'List of Retirees',
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
    admin: 'Administrator',
    dbm: 'DBM',
    departmnet: 'Department',
    agency: 'Agency',
    ou: 'Operating Unit',
    others: 'Others',
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