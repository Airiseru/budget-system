import { RETIREE_WORKFLOW } from "./retiree-flow"
import { STAFFING_WORKFLOW } from "./staffing-flow"

export type WorkflowTransition = {
    required_roles: string[]
    on_submit: string | null   // null for terminal states like 'approved'
    on_approve: string | null
    on_reject: string | null
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

export function getNextStatus(currentStatus: string, workflow: Workflow, action: 'submit' | 'approve' | 'reject'): string | null {
    if (action === 'submit') return workflow.transitions[currentStatus]?.on_submit ?? null
    else if (action === 'reject') return workflow.transitions[currentStatus]?.on_reject ?? null
    else return workflow.transitions[currentStatus]?.on_approve ?? null
}

export function getCurrentSignatoryRole(
    authStatus: string,
    workflow: Workflow
): string | null {
    return workflow.transitions[authStatus]?.signatory_role ?? null
}

export function getNextSignatoryRole(
    currentStatus: string,
    workflow: Workflow,
    action: 'submit' | 'approve' | 'reject'
): string | null {
    // Find next state
    const nextStatus = getNextStatus(currentStatus, workflow, action);
    
    // No next signatory if no next state
    if (!nextStatus) return null;
    
    // Return the signatory required for that future state
    return workflow.transitions[nextStatus]?.signatory_role ?? null;
}

export function isTerminalStatus(authStatus: string, workflow: Workflow, action: 'submit' | 'approve' | 'reject'): boolean {
    if (action === 'submit') return workflow.transitions[authStatus]?.on_submit === null
    else if (action === 'reject') return workflow.transitions[authStatus]?.on_reject === null
    else return workflow.transitions[authStatus]?.on_approve === null
}

export const WORKFLOWS: Record<string, Workflow> = {
    bp_staffing: STAFFING_WORKFLOW,
    bp_retiree: RETIREE_WORKFLOW
}

export function getWorkflow(formType: string): Workflow {
    const workflow = WORKFLOWS[formType]
    if (!workflow) {
        throw new Error(`Workflow not found for form type: ${formType}`)
    }
    return workflow
}