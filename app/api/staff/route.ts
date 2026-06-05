import { createStaffingRepository } from '@/src/db/factory'
import { NextResponse } from 'next/server'
import { auth } from "@/src/lib/auth"; 
import { headers } from "next/headers";
import { logNewForm, logSubmitForm } from '@/src/actions/audit';
import { getBudgetPrepClosedError, isBudgetPrepActiveForYear } from '@/src/lib/budget-cycle';

export const dynamic = 'force-dynamic';

const StaffingRepository = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')

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
        
        const { userId, entityId, summary, positions, auth_status } = body;

        if (!(await isBudgetPrepActiveForYear(summary.fiscal_year))) {
            return NextResponse.json(
                { error: getBudgetPrepClosedError(summary.fiscal_year) },
                { status: 403 }
            );
        }

        const result = await StaffingRepository.createStaffingSubmission(
            entityId, 
            summary.fiscal_year,
            positions,
            auth_status ?? "draft"
        );

        const logResult = await logNewForm(
            userId,
            entityId,
            'staffing_summaries',
            result.formId,
            {
                ...summary,
                positions
            },
            result.createdAt
        )
        
        if (!logResult.success) throw new Error('Failed to log form creation')

        if (auth_status !== 'draft') {
            const submitResult = await logSubmitForm(
                userId,
                entityId,
                'staffing_summaries',
                result.formId,
                {
                    ...summary,
                    positions
                },
                result.createdAt
            )
            
            if (!submitResult.success) throw new Error('Failed to log form submission')
        }

        return Response.json(result);
    } catch (error) {
        return Response.json({ error: "Failed to save" }, { status: 500 });
    }
}
