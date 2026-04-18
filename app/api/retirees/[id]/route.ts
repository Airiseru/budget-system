import { NextResponse } from 'next/server';
// Import the specific read function alongside your update functions
import { 
    updateRetirees, 
    updateRetireeListMetadata, 
    getRetireesFormById 
} from '@/src/db/postgres/repositories/retireeRepository';
import { BP205Schema } from '@/src/lib/validations/retiree.schema'; 
import { logSaveFormEdits, logSubmitForm } from '@/src/actions/audit';
import { createFormRepository } from '@/src/db/factory'

const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    
    try {
        // 1. THE LOCK CHECK: Verify status before doing anything else
        const current = await getRetireesFormById(id);
        
        if (!current) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 });
        }

        if (current.auth_status !== 'draft') {
            return NextResponse.json(
                { error: "This form is locked and cannot be edited." }, 
                { status: 403 }
            );
        }

        // 2. VALIDATION
        const body = await request.json();
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

        // 3. PREPARE & EXECUTE UPDATE
        const retireesWithId = retirees.map(r => ({
            ...r,
            retirees_list_id: id 
        }));

        await Promise.all([
            updateRetireeListMetadata(id, listData),
            updateRetirees(id, retireesWithId as any) 
        ]);

        const updated = await getRetireesFormById(id)

        if (!updated) {
            return NextResponse.json({ error: "Update failed" }, { status: 500 });
        }

        // Log form update
        const logResult = await logSaveFormEdits(
            body.userId,
            body.entityId,
            'retirees_list',
            id,
            current,
            updated,
            updated.updated_at
        )

        if (!logResult.success) {
            return NextResponse.json({ error: "Failed to log form update" }, { status: 500 });
        }

        if (body.auth_status !== 'draft') {
            const result = await FormRepository.updateFormAuthStatus(id, body.auth_status)

            // Log form submission
            const submitResult = await logSubmitForm(
                body.userId,
                body.entityId,
                'retirees_list',
                id,
                updated,
                result.updated_at
            )

            if (!submitResult.success) {
                return NextResponse.json({ error: "Failed to log form submission" }, { status: 500 });
            }
        }
            

        return NextResponse.json({ formId: id });

    } catch (error: any) {
        console.error("API_RETIREES_PUT_ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}