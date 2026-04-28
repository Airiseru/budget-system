export const PROPOSAL_WORKFLOW = {
    roles: [
        'planning_officer',
        'budget_officer',
        'chief_accountant',
        'agency_head'
    ],
    transitions: {
        draft: {
            required_roles: [],
            next_status: 'pending_budget',
            allowed_access_levels: ['encode'],
            signatory_role: '',
        },
        pending_budget: {
            required_roles: ['budget_officer'],
            next_status: 'pending_planning',
            allowed_access_levels: ['encode'],
            signatory_role: 'budget_officer',
        },
        pending_planning: {
            required_roles: ['planning_officer'],
            next_status: 'pending_agency_head',
            allowed_access_levels: ['encode'],
            signatory_role: 'planning_officer',
        },
        pending_chief_accountant: {
            required_roles: ['chief_accountant'],
            next_status: 'pending_agency_head',
            allowed_access_levels: ['encode'],
            signatory_role: 'chief_accountant',
        },
        pending_agency_head: {
            required_roles: ['agency_head'],
            next_status: 'approved',
            allowed_access_levels: ['approve'],
            signatory_role: 'agency_head',
        },
        approved: {
            required_roles: [],
            next_status: null,
            allowed_access_levels: [''],
            signatory_role: '',
        }
    }
}