export const ALLOCATION_SIGNOFF_WORKFLOW = {
    roles: ['dbm'],
    transitions: {
        pending_dbm: {
            required_roles: ['dbm'],
            on_submit: null,
            on_approve: 'approved',
            on_reject: null,
            allowed_access_levels: ['approve'],
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
    },
}
