import { NextResponse } from 'next/server';
// Import the specific read function alongside your update functions
import { 
    createDbmRetireeOverwrite,
    getRetireesFormById,
    updateRetireeSubmission 
} from '@/src/db/postgres/repositories/retireeRepository';
import { BP205Schema } from '@/src/lib/validations/retiree.schema'; 
import { logNewForm, logSaveFormEdits, logSubmitForm, logFormOverwrite } from '@/src/actions/audit';
import { createFormRepository } from '@/src/db/factory'

const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    
    try {
        const body = await request.json();
        const isDbm = body.isDbm ?? body.isDBM ?? false

        // 1. THE LOCK CHECK: Verify status before doing anything else
        const current = await getRetireesFormById(id);
        
        if (!current) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 });
        }

        const versionFamily = await FormRepository.getFormVersionFamily(id)
        const familyHasApprovedVersion = versionFamily.forms.some((form) => form.auth_status === 'approved')

        if (familyHasApprovedVersion) {
            return NextResponse.json(
                { error: "This form version family is locked because a DBM-approved version already exists." }, 
                { status: 403 }
            );
        }

        const canEditDraft = current.auth_status === 'draft'
        const canEditPendingDbm = isDbm && current.auth_status === 'pending_dbm'

        if (!canEditDraft && !canEditPendingDbm) {
            return NextResponse.json(
                { error: "This form is locked and cannot be edited." }, 
                { status: 403 }
            );
        }

        // 2. VALIDATION
        const validation = BP205Schema.safeParse(body);
        
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { listData, retirees } = validation.data;

        if (!listData) {
            return NextResponse.json({ error: "Missing form metadata" }, { status: 400 });
        }

        const retireesWithId = retirees.map(r => ({
            ...r,
            retirees_list_id: id 
        }));

        const shouldCreateDbmCopy =
            isDbm &&
            current.auth_status === 'pending_dbm' &&
            !current.parent_form_id

        const overwriteResult = shouldCreateDbmCopy
            ? await createDbmRetireeOverwrite(id, listData, retireesWithId as any, body.auth_status)
            : null

        const targetFormId = overwriteResult?.formId ?? id

        if (!shouldCreateDbmCopy) {
            await updateRetireeSubmission(id, listData, retireesWithId as any, body.auth_status)
        }

        const updated = await getRetireesFormById(targetFormId)

        if (!updated) {
            return NextResponse.json({ error: "Update failed" }, { status: 500 });
        }

        if (overwriteResult?.created) {
            const logCreateResult = await logNewForm(
                body.userId,
                current.entity_id,
                'retirees_list',
                targetFormId,
                {
                    fiscal_year: updated.fiscal_year,
                    is_mandatory: updated.is_mandatory,
                    retirees: updated.retirees
                },
                updated.updated_at
            )

            if (!logCreateResult.success) {
                return NextResponse.json({ error: "Failed to log overwritten form creation" }, { status: 500 });
            }
        }

        // Log form update
        const logResult = await logSaveFormEdits(
            body.userId,
            current.entity_id,
            'retirees_list',
            targetFormId,
            current,
            updated,
            updated.updated_at
        )

        if (!logResult.success) {
            return NextResponse.json({ error: "Failed to log form update" }, { status: 500 });
        }

        if (body.auth_status === 'pending_personnel') {
            const result = await FormRepository.updateFormAuthStatus(targetFormId, body.auth_status)

            // Log form submission
            const submitResult = await logSubmitForm(
                body.userId,
                current.entity_id,
                'retirees_list',
                targetFormId,
                updated,
                result.updated_at
            )

            if (!submitResult.success) {
                return NextResponse.json({ error: "Failed to log form submission" }, { status: 500 });
            }
        }
        else if (body.auth_status === 'pending_dbm') {
            const result = await FormRepository.updateFormAuthStatus(targetFormId, body.auth_status)

            const overwriteLogResult = await logFormOverwrite(
                body.userId,
                current.entity_id,
                'retirees_list',
                targetFormId,
                current,
                updated,
                result.updated_at
            )

            if (!overwriteLogResult.success) {
                return NextResponse.json({ error: "Failed to log form overwrite" }, { status: 500 });
            }
        }

        return NextResponse.json({ formId: targetFormId });

    } catch (error: any) {
        console.error("API_RETIREES_PUT_ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
