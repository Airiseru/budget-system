import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";
import { logNewForm, logSubmitForm } from "@/src/actions/audit";
import { createProposalRepository } from "@/src/db/factory";
import {
    getBudgetPrepClosedError,
    isBudgetPrepActiveForYear,
} from "@/src/lib/budget-cycle";
import { sessionWithEntity } from "@/src/actions/auth";

const repo = createProposalRepository(process.env.DATABASE_TYPE || "postgres");
type PgError = Error & { code?: string; detail?: string };

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    // 1. Authorization Gate
    if (!session || session.user.access_level !== "encode") {
        return NextResponse.json(
            {
                error: "Unauthorized: Only encoders can create project proposals.",
            },
            { status: 403 },
        );
    }

    try {
        const body = await req.json();
        const { userId, entityId, payload, auth_status, existingPapId } = body;

        if (!(await isBudgetPrepActiveForYear(payload.proposal_year))) {
            return NextResponse.json(
                { error: getBudgetPrepClosedError(payload.proposal_year) },
                { status: 403 },
            );
        }

        const result = await repo.createProjectProposal(
            entityId,
            payload, // Keep this if your repo needs the raw arrays for child tables
            auth_status ?? "draft",
            payload.proposal_year, // this is practically the fiscal year
            undefined,
            undefined,
            existingPapId,
        );

        // 3. Audit Logging (Creation)
        const logResult = await logNewForm(
            userId,
            entityId,
            "project_proposals",
            result.formId,
            payload,
            result.createdAt,
        );

        if (!logResult.success)
            throw new Error("Failed to log project creation");

        // 4. Audit Logging (Submission)
        // If the user clicked "Submit" immediately instead of just "Save Draft"
        if (auth_status && auth_status !== "draft") {
            const submitResult = await logSubmitForm(
                userId,
                entityId,
                "project_proposals",
                result.formId,
                payload,
                result.createdAt,
            );
            if (!submitResult.success)
                throw new Error("Failed to log project submission");
        }

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error("POST PROJECT ERROR:", error);
        const pgError = error as PgError;

        // If it's a unique constraint violation, send a specific response
        if (
            pgError.code === "23505" ||
            (error instanceof Error && error.message === "unique_entity_rank")
        ) {
            return NextResponse.json(
                {
                    code: "23505",
                    error: "This priority rank is already taken by another proposal.",
                    message: "Duplicate priority rank detected.",
                    detail: pgError.detail,
                },
                { status: 409 }, // Conflict
            );
        }

        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}

export async function GET(req: Request) {
    try {
        const session = await sessionWithEntity();

        if (!session?.user?.id || !session.user.entity_id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(req.url);
        const entityId = searchParams.get("entityId");
        const yearParam = searchParams.get("year");
        const fiscalYear = yearParam ? Number(yearParam) : undefined;

        if (!entityId) {
            return NextResponse.json(
                { error: "Missing entityId" },
                { status: 400 },
            );
        }

        if (entityId !== session.user.entity_id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (
            yearParam &&
            (!Number.isInteger(fiscalYear) || Number(fiscalYear) < 1)
        ) {
            return NextResponse.json(
                { error: "Invalid fiscal year" },
                { status: 400 },
            );
        }

        const data = await repo.getAllProposalSummaries(
            session.user_entity?.entity_type ?? "",
            session.user.role,
            entityId,
            fiscalYear,
        );

        // No filtering here — the frontend's visibleProposals already
        // filters by priority_rank vs dept_priority_rank based on activeScope
        return NextResponse.json(data);
    } catch (error) {
        console.error("Fetch error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
