import { NextResponse } from 'next/server';
import { auth } from "@/src/lib/auth"; 
import { headers } from "next/headers";
import { logNewForm, logSubmitForm } from '@/src/actions/audit';
import { createProposalRepository } from '@/src/db/factory';

const repo = createProposalRepository(process.env.DATABASE_TYPE || 'postgres');

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    // 1. Authorization Gate
    if (!session || session.user.access_level !== 'encode') {
        return NextResponse.json(
            { error: "Unauthorized: Only encoders can create project proposals." },
            { status: 403 }
        );
    }

    try {
        const body = await req.json();
        const { userId, entityId, summaryData, payload, auth_status } = body;

        // Combine summaryData and payload into one object for the repository
        const combinedProposalData = {
            ...summaryData,
            ...payload
        };

        const result = await repo.createProjectProposal(
            entityId,
            combinedProposalData, // Pass the flattened object here
            payload,              // Keep this if your repo needs the raw arrays for child tables
            auth_status ?? "draft"
        );

        // 3. Audit Logging (Creation)
        const logResult = await logNewForm(
            userId,
            entityId,
            'project_proposals',
            result.formId,
            { ...summaryData, ...payload },
            result.createdAt
        );
        
        if (!logResult.success) throw new Error('Failed to log project creation');

        // 4. Audit Logging (Submission)
        // If the user clicked "Submit" immediately instead of just "Save Draft"
        if (auth_status && auth_status !== 'draft') {
            const submitResult = await logSubmitForm(
                userId,
                entityId,
                'project_proposals',
                result.formId,
                { ...summaryData, ...payload },
                result.createdAt
            );
            if (!submitResult.success) throw new Error('Failed to log project submission');
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("POST PROJECT ERROR:", error);
        return NextResponse.json({ error: "Failed to save project proposal" }, { status: 500 });
    }
}