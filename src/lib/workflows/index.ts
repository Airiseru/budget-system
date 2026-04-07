import { STAFFING_WORKFLOW } from "./staffing-flow"

export type WorkflowTransition = {
    required_roles: string[]
    next_status: string | null   // null for terminal states like 'approved'
    allowed_access_levels: string[]
    signatory_role: string | null  // null for draft which needs no signature
}

export type Workflow = {
    roles: string[]
    transitions: Record<string, WorkflowTransition>
}

export function canSign(
    authStatus: string,
    userAccessLevel: string,
    userWorkflowRole: string,
    requiredSignatoryRole: string,
    workflow: Workflow,
): boolean {
    const allowedLevels = workflow.transitions[authStatus]?.allowed_access_levels || []
    if (!allowedLevels.includes(userAccessLevel)) return false

    // Check if the user's workflow role matches the required signatory role
    if (userWorkflowRole !== requiredSignatoryRole) return false

    return true
}

export function getNextStatus(currentStatus: string, workflow: Workflow): string | null {
    return workflow.transitions[currentStatus]?.next_status ?? null
}

export function getCurrentSignatoryRole(
    authStatus: string,
    workflow: Workflow
): string | null {
    return workflow.transitions[authStatus]?.signatory_role ?? null
}

export function getNextSignatoryRole(
    authStatus: string,
    workflow: Workflow
): string | null {
    return workflow.transitions[authStatus]?.signatory_role ?? null
}

export function isTerminalStatus(authStatus: string, workflow: Workflow): boolean {
    return workflow.transitions[authStatus]?.next_status === null
}

export const WORKFLOWS: Record<string, Workflow> = {
    staffing: STAFFING_WORKFLOW
}

export function getWorkflow(formType: string): Workflow {
    const workflow = WORKFLOWS[formType]
    if (!workflow) {
        throw new Error(`Workflow not found for form type: ${formType}`)
    }
    return workflow
}