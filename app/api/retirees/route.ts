// app/api/retirees/route.ts
import { NextResponse } from 'next/server';
import { createRetireeRepository } from '@/src/db/factory';
import { auth } from "@/src/lib/auth"; 
import { headers } from "next/headers";
import { logNewForm, logSubmitForm } from '@/src/actions/audit';

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

        // Log form creation
        const logResult = await logNewForm(
            session.user.id,
            entityId,
            'retirees_list',
            result.formId,
            {
                fiscal_year: listData.fiscal_year,
                is_mandatory: listData.is_mandatory,
                retirees: retirees
            },
            result.createdAt
        )

        if (!logResult.success) throw new Error('Failed to log form creation')

        if (auth_status !== 'draft') {
            const submitResult = await logSubmitForm(
                session.user.id,
                entityId,
                'retirees_list',
                result.formId,
                {
                    fiscal_year: listData.fiscal_year,
                    is_mandatory: listData.is_mandatory,
                    ...retirees
                },
                result.createdAt
            )

            if (!submitResult.success) throw new Error('Failed to log form submission')
        }

        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}