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
import {
    getActiveBudgetPrepCycle,
    getBudgetPrepClosedError,
    isBudgetPrepActiveForYear,
} from '@/src/lib/budget-cycle';
import { NewRetireeRecord } from '@/src/types/retirees';

const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

async function canDbmOverwriteForFiscalYear(fiscalYear: number) {
    const activeCycle = await getActiveBudgetPrepCycle();
    return (
        activeCycle?.fiscal_year === fiscalYear &&
        (activeCycle.current_phase === 'preparation' ||
            activeCycle.current_phase === 'dbm_review')
    );
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    
    try {
        const body = await request.json();
        const isDbm = body.isDbm ?? body.isDBM ?? false
        const overrideRemarks =
            typeof body.overrideRemarks === 'string' ? body.overrideRemarks.trim() : ''

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

        if (
            canEditPendingDbm &&
            !(await canDbmOverwriteForFiscalYear(current.fiscal_year))
        ) {
            return NextResponse.json(
                { error: "DBM can only overwrite forms during the Preparation or DBM Review phases." },
                { status: 403 }
            );
        }

        if (canEditPendingDbm && !overrideRemarks) {
            return NextResponse.json(
                { error: "DBM remarks are required when overwriting or changing this form." },
                { status: 400 }
            );
        }

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

        const isSubmitting =
            body.auth_status === 'pending_personnel' ||
            body.auth_status === 'pending_dbm'

        if (!isDbm && isSubmitting && !(await isBudgetPrepActiveForYear(listData.fiscal_year))) {
            return NextResponse.json(
                { error: getBudgetPrepClosedError(listData.fiscal_year) },
                { status: 403 }
            );
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
            ? await createDbmRetireeOverwrite(id, listData, retireesWithId as NewRetireeRecord[], body.auth_status)
            : null

        const targetFormId = overwriteResult?.formId ?? id

        if (!shouldCreateDbmCopy) {
            await updateRetireeSubmission(id, listData, retireesWithId as NewRetireeRecord[], body.auth_status)
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

            if (body.auth_status === 'pending_dbm') {
                const firstOverwriteLogResult = await logFormOverwrite(
                    body.userId,
                    current.entity_id,
                    'retirees_list',
                    targetFormId,
                    current,
                    updated,
                    updated.updated_at,
                    overrideRemarks
                )

                if (!firstOverwriteLogResult.success) {
                    return NextResponse.json({ error: "Failed to log initial form overwrite" }, { status: 500 });
                }
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

            if (!overwriteResult?.created) {
                const overwriteLogResult = await logFormOverwrite(
                    body.userId,
                    current.entity_id,
                    'retirees_list',
                    targetFormId,
                    current,
                    updated,
                    result.updated_at,
                    overrideRemarks
                )

                if (!overwriteLogResult.success) {
                    return NextResponse.json({ error: "Failed to log form overwrite" }, { status: 500 });
                }
            }
        }

        return NextResponse.json({ formId: targetFormId });

    } catch (error: unknown) {
        console.error("API_RETIREES_PUT_ERROR:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update form" },
            { status: 500 }
        );
    }
}
