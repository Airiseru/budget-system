import { createStaffingRepository } from '@/src/db/factory'
import { NextResponse } from 'next/server'
import { auth } from "@/src/lib/auth"; 
import { headers } from "next/headers";
import { logNewForm, logSubmitForm } from '@/src/actions/audit';

export const dynamic = 'force-dynamic';

// Initialize the repository via the factory
const StaffingRepository = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')

// export async function GET(request: Request) {
//     try {
//         // Fetches all summaries (with the auth_status join we added to the repo)
//         const summaries = await StaffingRepository.getAllStaffingSummaries()
        
//         console.log(`GET STAFFING SUMMARIES RESULT: ${summaries.length} items found`)
//         return NextResponse.json(summaries)
//     } catch (error) {
//         console.error("GET STAFFING ERROR:", error)
//         return NextResponse.json({ error: "Failed to fetch staffing data" }, { status: 500 })
//     }
// }

export async function POST(req: Request) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    // 2. Check if user is logged in AND has 'encode' access
    if (!session || session.user.access_level !== 'encode') {
        return NextResponse.json(
            { error: "Unauthorized: Only encoders can create new forms." },
            { status: 403 }
        );
    }
    try {
        const body = await req.json();
        
        // Destructure the payload sent by the form
        const { userId, entityId, summary, positions, auth_status } = body;

        // Ensure you pass 'summary' (which contains fiscal_year) 
        // to your repository function, not the whole body.
        const result = await StaffingRepository.createStaffingSubmission(
            entityId, 
            summary.fiscal_year, // This must contain { fiscal_year, digital_signature }
            positions,
            auth_status ?? "draft"
        );

        // Log form creation
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
            // Log form submission
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
        console.error("POST STAFFING ERROR:", error);
        return Response.json({ error: "Failed to save" }, { status: 500 });
    }
}