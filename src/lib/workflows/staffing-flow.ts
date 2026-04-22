export const STAFFING_WORKFLOW = {
    roles: [
        'personnel_officer',
        'budget_officer',
        'agency_head',
        'dbm'
    ],
    transitions: {
        draft: {
            required_roles: [],
            next_status: 'pending_personnel',
            allowed_access_levels: ['encode'],
            signatory_role: '',
        },
        pending_personnel: {
            required_roles: ['personnel_officer'],
            next_status: 'pending_budget',
            allowed_access_levels: ['encode'],
            signatory_role: 'personnel_officer',
        },
        pending_budget: {
            required_roles: ['budget_officer'],
            next_status: 'pending_agency_head',
            allowed_access_levels: ['encode'],
            signatory_role: 'budget_officer',
        },
        pending_agency_head: {
            required_roles: ['agency_head'],
            next_status: 'pending_dbm',
            allowed_access_levels: ['approve'],
            signatory_role: 'agency_head',
        },
        pending_dbm: {
            required_roles: ['dbm'],
            next_status: 'approved',
            allowed_access_levels: ['approve'],
            signatory_role: 'dbm',
        },
        approved: {
            required_roles: [],
            next_status: null,
            allowed_access_levels: [''],
            signatory_role: '',
        }
    }
}