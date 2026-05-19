export function isAdminUser(user: { is_admin?: boolean | null }) {
    return user.is_admin === true
}

export function isUnverifiedUser(user: { status?: string | null }) {
    return user.status === 'unverified'
}

export function isActiveUser(user: { status?: string | null }) {
    return user.status === 'active'
}

export function isDbmUser(user: { role?: string | null, access_level?: string | null }) {
    return user.role === 'dbm' && user.access_level === 'approve'
}

export function canViewFormIntegrity(user: {
    role?: string | null
    workflow_role?: string | null
    is_admin?: boolean | null
}) {
    return (
        isAdminUser(user) ||
        user.role === 'dbm' ||
        user.workflow_role === 'department_secretary'
    )
}
