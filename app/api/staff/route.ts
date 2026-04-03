import { createStaffingRepository } from '@/src/db/factory'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';

// Initialize the repository via the factory
const StaffingRepository = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')

export async function GET(request: Request) {
    try {
        // Fetches all summaries (with the auth_status join we added to the repo)
        const summaries = await StaffingRepository.getAllStaffingSummaries()
        
        console.log(`GET STAFFING SUMMARIES RESULT: ${summaries.length} items found`)
        return NextResponse.json(summaries)
    } catch (error) {
        console.error("GET STAFFING ERROR:", error)
        return NextResponse.json({ error: "Failed to fetch staffing data" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        
        // Destructure the payload we're sending from the React frontend
        const { entityId, papId, summary, positions } = body

        // Execute the triple-insert transaction in the repository
        const result = await StaffingRepository.createStaffingSubmission(
            entityId,
            papId,
            summary,
            positions
        )

        console.log(`CREATE STAFFING RESULT: Success for Form ID ${result.formId}`)
        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        console.error("POST STAFFING ERROR:", error)
        return NextResponse.json(
            { error: "Failed to create staffing submission" }, 
            { status: 500 }
        )
    }
}