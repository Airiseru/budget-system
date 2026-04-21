export const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
    pending_agency_head: 'Pending Agency Head',
    approved: 'Approved',
}

export const TLB_FACTOR = 0.0481927

export const MAX_SG = 33
export const MAX_STEP = 8

export const VALID_COMPENSATION_NAMES = [
    'PERA', 'RATA', 'Clothing Allowance', 'Mid-Year Bonus',
    'Year-End Bonus', 'Cash Gift', 'PEI', 'RLIP',
    'Pag-IBIG', 'ECiP', 'PHIC', 'Medical Allowance',
    "Compensation Related Magna Compensation Carta Benefits"
]