// app/api/retirees/route.ts
import { NextResponse } from 'next/server';
import { createRetireeRepository } from '@/src/db/factory';

const repo = createRetireeRepository(process.env.DATABASE_TYPE || 'postgres');

export async function POST(req: Request) {
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