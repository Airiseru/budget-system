import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";
import { logNewForm, logSubmitForm } from "@/src/actions/audit";
import { createProposalRepository } from "@/src/db/factory";

const repo = createProposalRepository(process.env.DATABASE_TYPE || "postgres");

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
        const { userId, entityId, summaryData, payload, auth_status } = body;

        // Ensure fiscal_year is extracted and cast to a number to prevent "invalid input syntax"
        const fiscalYear = Number(summaryData.proposal_year);

        // 2. Call repository with correct argument order
        const result = await repo.createProjectProposal(
            entityId, // arg 1: entityId
            fiscalYear, // arg 2: fiscal_year (integer)
            summaryData, // arg 3: proposalData (title, rank, etc.)
            payload, // arg 4: payload (the arrays: cost_by_components, etc.)[cite: 4]
            auth_status ?? "draft", // arg 5: authStatus[cite: 4]
        );

        // 3. Audit Logging (Creation)
        const logResult = await logNewForm(
            userId,
            entityId,
            "project_proposals",
            result.formId,
            { ...summaryData, ...payload },
            result.createdAt,
        );

        if (!logResult.success)
            throw new Error("Failed to log project creation");

        // 4. Audit Logging (Submission)
        if (auth_status && auth_status !== "draft") {
            const submitResult = await logSubmitForm(
                userId,
                entityId,
                "project_proposals",
                result.formId,
                { ...summaryData, ...payload },
                result.createdAt,
            );
            if (!submitResult.success)
                throw new Error("Failed to log project submission");
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("POST PROJECT ERROR:", error);
        return NextResponse.json(
            { error: "Failed to save project proposal" },
            { status: 500 },
        );
    }
}
