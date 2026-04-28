import { NextResponse } from 'next/server';
import { auth } from "@/src/lib/auth"; 
import { headers } from "next/headers";
import { createProposalRepository } from '@/src/db/factory';

const repo = createProposalRepository(process.env.DATABASE_TYPE || 'postgres');

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const existing = await repo.getProjectProposalById(id);

        if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });
        
        // LOCKING LOGIC: Same as Retirees/Staffing
        if (existing.auth_status !== 'draft') {
            return NextResponse.json({ error: "Only drafts can be updated" }, { status: 403 });
        }

        // updateProjectProposal should handle deleting and re-inserting child arrays
        const result = await repo.updateProjectProposal(id, body);
        return NextResponse.json(result);
    } catch (error) {
        console.error("PUT PROJECT ERROR:", error);
        return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const existing = await repo.getProjectProposalById(params.id);
        if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

        if (existing.auth_status !== 'draft') {
            return NextResponse.json({ error: "Forbidden: Only drafts can be deleted" }, { status: 403 });
        }

        await repo.deleteProjectProposal(params.id);
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}