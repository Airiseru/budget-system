import { createStaffingRepository } from '@/src/db/factory'
import { NextResponse } from 'next/server'

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
    
    // In your repository, you'll need an updateStaffingSubmission function
    // that handles updating the summary and potentially syncing the position rows.
    const result = await StaffingRepository.updateStaffingSubmission(id, body)
    
    return NextResponse.json(result)
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