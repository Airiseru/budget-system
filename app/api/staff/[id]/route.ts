import { createStaffingRepository, createFormRepository } from '@/src/db/factory'
import { NextResponse } from 'next/server'
import { logNewForm, logSaveFormEdits, logSubmitForm, logFormOverwrite } from '@/src/actions/audit'
export const dynamic = 'force-dynamic';
const StaffingRepository = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')
const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

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
    const isDbm = body.isDbm ?? body.isDBM ?? false

    const staffingBody = {
        summary: body.summary,
        positions: body.positions,
        auth_status: body.auth_status
    }

    console.log(`PUT BODY: ${JSON.stringify(body)}`)
    console.log(`isDbm: ${isDbm}`)

    // Check current status in DB before updating
    const existing = await StaffingRepository.getStaffingWithFormById(id)
    
    if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const familyHasApprovedVersion = await FormRepository.hasApprovedFormInFamily(id)

    if (familyHasApprovedVersion) {
        return NextResponse.json(
            { error: "This form version family is locked because a DBM-approved version already exists." },
            { status: 403 }
        )
    }

    const canEditDraft = existing.auth_status === 'draft'
    const canEditPendingDbm = isDbm && existing.auth_status === 'pending_dbm'

    if (!canEditDraft && !canEditPendingDbm) {
        return NextResponse.json(
            { error: "Only drafts can be modified." }, 
            { status: 403 } // 403 Forbidden
        )
    }

    const shouldCreateDbmCopy =
        isDbm &&
        existing.auth_status === 'pending_dbm' &&
        !existing.parent_form_id

    const overwriteResult = shouldCreateDbmCopy
        ? await StaffingRepository.createDbmStaffingOverwrite(id, staffingBody)
        : null

    const targetFormId = overwriteResult?.formId ?? id

    if (!shouldCreateDbmCopy) {
        await StaffingRepository.updateStaffingSubmission(id, staffingBody)
    }

    const updated = await StaffingRepository.getStaffingWithFormById(targetFormId)

    if (!updated) {
        return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    if (overwriteResult?.created) {
        const logCreateResult = await logNewForm(
            body.userId,
            existing.entity_id,
            'staffing_summaries',
            targetFormId,
            {
                ...staffingBody.summary,
                positions: staffingBody.positions
            },
            updated.created_at
        )

        if (!logCreateResult.success) {
            return NextResponse.json({ error: "Failed to log overwritten form creation" }, { status: 500 })
        }
    }

    // Log form edit
    const logResult = await logSaveFormEdits(
            body.userId,
            existing.entity_id,
            'staffing_summaries',
            targetFormId,
            existing,
            updated,
            updated.updated_at
        )

    if (!logResult.success) {
        return NextResponse.json({ error: "Failed to log form update" }, { status: 500 })
    }

    if (body.auth_status === 'pending_personnel') {
        const result = await FormRepository.updateFormAuthStatus(targetFormId, body.auth_status)

        // Log form update
        const submitResult = await logSubmitForm(
            body.userId,
            existing.entity_id,
            'staffing_summaries',
            targetFormId,
            updated,
            result.updated_at
        )

        if (!submitResult.success) {
            return NextResponse.json({ error: "Failed to log form submission" }, { status: 500 })
        }
    }
    else if (body.auth_status === 'pending_dbm') {
        const result = await FormRepository.updateFormAuthStatus(targetFormId, body.auth_status)

        // Log form overwrite
        const overwriteLogResult = await logFormOverwrite(
            body.userId,
            existing.entity_id,
            'staffing_summaries',
            targetFormId,
            existing,
            updated,
            result.updated_at
        )

        if (!overwriteLogResult.success) {
            return NextResponse.json({ error: "Failed to log form overwrite" }, { status: 500 })
        }
    }

    return NextResponse.json({ success: true, summaryId: targetFormId })
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
