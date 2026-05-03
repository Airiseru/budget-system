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

        // Combine summaryData and payload into one object for the repository
        const combinedProposalData = {
            ...summaryData,
            ...payload,
        };

        const result = await repo.createProjectProposal(
            entityId,
            combinedProposalData, // Pass the flattened object here
            payload, // Keep this if your repo needs the raw arrays for child tables
            auth_status ?? "draft",
            payload.proposal_year, // this is practically the fiscal year
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
        // If the user clicked "Submit" immediately instead of just "Save Draft"
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
    } catch (error: any) {
        console.error("POST PROJECT ERROR:", error);

        // If it's a unique constraint violation, send a specific response
        if (error.code === "23505") {
            return NextResponse.json(
                {
                    code: "23505",
                    message: "Duplicate priority rank detected.",
                    detail: error.detail,
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
        const { searchParams } = new URL(req.url);
        const entityId = searchParams.get("entityId");

        if (!entityId) {
            return NextResponse.json(
                { error: "Missing entityId" },
                { status: 400 },
            );
        }

        // Fetch using your existing repository function
        // Note: adjust the userId/entityType based on your session logic
        const data = await repo.getAllProposalSummaries("", "admin", entityId);

        return NextResponse.json(data);
    } catch (error) {
        console.error("Fetch error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
        );
    }
}
