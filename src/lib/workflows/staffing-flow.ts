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
            on_submit: 'pending_personnel',
            on_approve: null,
            on_reject: null,
            allowed_access_levels: ['encode'],
            signatory_role: '',
        },
        pending_personnel: {
            required_roles: ['personnel_officer'],
            on_submit: null,
            on_approve: 'pending_budget',
            on_reject: 'draft',
            allowed_access_levels: ['encode'],
            signatory_role: 'personnel_officer',
        },
        pending_budget: {
            required_roles: ['budget_officer'],
            on_submit: null,
            on_approve: 'pending_agency_head',
            on_reject: 'draft',
            allowed_access_levels: ['encode'],
            signatory_role: 'budget_officer',
        },
        pending_agency_head: {
            required_roles: ['agency_head'],
            on_submit: null,
            on_approve: 'pending_dbm',
            on_reject: 'draft',
            allowed_access_levels: ['approve'],
            signatory_role: 'agency_head',
        },
        pending_dbm: {
            required_roles: ['dbm'],
            on_submit: null,
            on_approve: 'approved',
            on_reject: 'rejected',
            allowed_access_levels: ['review', 'approve'],
            signatory_role: 'dbm',
        },
        approved: {
            required_roles: [],
            on_submit: null,
            on_approve: null,
            on_reject: null,
            allowed_access_levels: [''],
            signatory_role: '',
        },
        rejected: {
            required_roles: [],
            on_submit: null,
            on_approve: null,
            on_reject: null,
            allowed_access_levels: [''],
            signatory_role: '',
        }
    }
}