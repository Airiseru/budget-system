"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDbm } from "./admin";
import { db } from "../db/postgres/database";
import {
    createBudgetSettingsRepository,
    createEntityRepository,
    createProposalRepository,
    createFormRepository,
    createPapRepository,
} from "../db/factory";

const ProposalRepository = createProposalRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const BudgetSettingsRepository = createBudgetSettingsRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const EntityRepository = createEntityRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const FormRepository = createFormRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const PapRepository = createPapRepository(
    process.env.DATABASE_TYPE || "postgres",
);
const PAGE_SIZE = 20;

const RejectProposalSchema = z.object({
    proposal_id: z.string().uuid(),
});

const CompleteScopeSchema = z.object({
    fiscal_year: z.preprocess((value) => Number(value), z.number().int()),
    scope_type: z.enum(["department", "agency", "operating_unit"]),
    scope_id: z.string().uuid(),
});

export async function loadDbmProposalReview(params: {
    year?: number;
    status?: string;
    departmentId?: string;
    agencyId?: string;
    operatingUnitId?: string;
    search?: string;
    page?: number;
}) {
    await requireDbm();

    const [
        cycles,
        activeCycle,
        entitySegments,
    ] = await Promise.all([
        BudgetSettingsRepository.listBudgetCycles(),
        BudgetSettingsRepository.getActiveBudgetCycle(),
        EntityRepository.getAllEntitySegments(true),
    ]);

    const viewingYear =
        params.year ?? activeCycle?.fiscal_year ?? cycles[0]?.fiscal_year;
    const page = Math.max(1, params.page ?? 1);
    const filters = {
        fiscalYear: viewingYear,
        status: params.status || "pending_dbm",
        departmentId: params.departmentId,
        agencyId: params.agencyId,
        operatingUnitId: params.operatingUnitId,
        search: params.search ?? "",
    };

    const [rows, totalCount] = await Promise.all([
        ProposalRepository.listDbmProposalReviewRows({
            ...filters,
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
        }),
        ProposalRepository.countDbmProposalReviewRows(filters),
    ]);

    return {
        rows,
        totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
        page,
        viewingYear,
        availableYears: cycles.map((cycle) => cycle.fiscal_year),
        selectedStatus: filters.status,
        selectedDepartmentId: params.departmentId ?? "all",
        selectedAgencyId: params.agencyId ?? "all",
        selectedOperatingUnitId: params.operatingUnitId ?? "all",
        search: filters.search,
        departments: entitySegments.departments,
        agencies: entitySegments.agencies,
        operatingUnits: entitySegments.operatingUnits,
    };
}

export async function rejectProposalAction(formData: FormData) {
    await requireDbm();
    const parsed = RejectProposalSchema.parse({
        proposal_id: formData.get("proposal_id"),
    });
    await FormRepository.updateFormAuthStatus(parsed.proposal_id, "rejected");
    await PapRepository.updatePapProjectStatusForFormWithExecutor(
        db,
        parsed.proposal_id,
        "rejected",
    );
    revalidatePath("/dbm/proposals");
}

export async function completeProposalScopeAction(formData: FormData) {
    await requireDbm();
    const parsed = CompleteScopeSchema.parse({
        fiscal_year: formData.get("fiscal_year"),
        scope_type: formData.get("scope_type"),
        scope_id: formData.get("scope_id"),
    });

    const rejectedCount =
        await ProposalRepository.updatePendingDbmProposalScopesToRejected({
            fiscalYear: parsed.fiscal_year,
            departmentId:
                parsed.scope_type === "department"
                    ? parsed.scope_id
                    : undefined,
            agencyId:
                parsed.scope_type === "agency" ? parsed.scope_id : undefined,
            operatingUnitId:
                parsed.scope_type === "operating_unit"
                    ? parsed.scope_id
                    : undefined,
        });

    void rejectedCount;
    revalidatePath("/dbm/proposals");
}
