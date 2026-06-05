import type { AuditEventType } from "@/src/types/audit";
import type { BUDGET_PREP_WORKFLOW_STAGES_TYPE } from "./constants";
import { formatDateOnlyForInput } from "./dateOnly";

export type AllocationAuditRecordType = "nep" | "gaa";

export type AllocationFieldChange = {
    from: string | number | null;
    to: string | number | null;
};

export type AllocationAuditPayload = {
    allocation_id: string;
    fiscal_year: number;
    workflow_stage: BUDGET_PREP_WORKFLOW_STAGES_TYPE;
    field_changes?: Record<string, AllocationFieldChange>;
    scope?: Record<string, string | number | null>;
    inserted_allocation?: Record<string, string | number | null>;
    action?: string;
};

export function getAllocationAuditRecordId(
    recordType: AllocationAuditRecordType,
    fiscalYear: number,
) {
    return `${recordType}:${fiscalYear}`;
}

export function getAllocationAuditRecordTypeForField(field: string) {
    return field === "gaa_amt" || field === "valid_from" || field === "valid_until"
        ? "gaa"
        : "nep";
}

export function normalizeAuditDate(value: Date | string | null | undefined) {
    if (!value) return null;
    return formatDateOnlyForInput(value);
}

export function hasFieldChanges(
    fieldChanges: Record<string, AllocationFieldChange>,
) {
    return Object.values(fieldChanges).some((change) => change.from !== change.to);
}

export function getAllocationAmountAuditEventType(params: {
    field: string;
    before: number;
    after: number;
}): AuditEventType {
    if (params.field === "nep_amt" && params.before > 0 && params.after === 0) {
        return "VETO_NEP_ALLOCATION";
    }

    return "UPDATE_ALLOCATION_AMOUNT";
}
