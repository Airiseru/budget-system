import { createStaffingRepository } from '@/src/db/factory'
import { NextResponse } from 'next/server'
import { logSaveFormEdits } from '@/src/actions/audit';
import { up } from '@/src/db/postgres/migrations/02_pap';

export const dynamic = 'force-dynamic';
const StaffingRepository = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    
    // This should return the summary AND its positions
    const staffing = await StaffingRepository.getStaffingWithFormById(id)

    if (!staffing) {
        return new NextResponse('Staffing Summary not found', { status: 404 })
    }

    return NextResponse.json(staffing)
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const body = await request.json()

    console.log(`PUT BODY: ${JSON.stringify(body)}`)

    // Check current status in DB before updating
    const existing = await StaffingRepository.getStaffingWithFormById(id)
    
    if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (existing.auth_status !== 'draft') {
        return NextResponse.json(
            { error: "Only drafts can be modified." }, 
            { status: 403 } // 403 Forbidden
        )
    }

    await StaffingRepository.updateStaffingSubmission(id, body)

    const updated = await StaffingRepository.getStaffingWithFormById(id)

    if (!updated) {
        return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }


    // Log form update
    const logResult = await logSaveFormEdits(
        body.userId,
        body.entityId,
        'staffing_summaries',
        id,
        existing,
        updated,
        updated.updated_at
    )

    if (!logResult.success) {
        return NextResponse.json({ error: "Failed to log form update" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    
    try {
        // This should delete the entry in 'forms', which cascades 
        // to 'staffing_summary' and 'position'
        await StaffingRepository.deleteStaffingForm(id)
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("DELETE ERROR:", error)
        return NextResponse.json({ error: "Delete failed" }, { status: 500 })
    }
}