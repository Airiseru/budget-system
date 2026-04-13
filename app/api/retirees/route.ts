// app/api/retirees/route.ts
import { NextResponse } from 'next/server';
import { createRetireeRepository } from '@/src/db/factory';
import { auth } from "@/src/lib/auth"; 
import { headers } from "next/headers";

const repo = createRetireeRepository(process.env.DATABASE_TYPE || 'postgres');

export async function POST(req: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session || session.user.access_level !== 'encode') {
        return NextResponse.json(
            { error: "Unauthorized: Only encoders can create new forms." },
            { status: 403 }
        );
    }

    try {
        const body = await req.json();
        const { entityId, listData, retirees, auth_status } = body;

        const result = await repo.createRetireeSubmission(
            entityId,
            listData,
            retirees,
            auth_status
        );

        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}