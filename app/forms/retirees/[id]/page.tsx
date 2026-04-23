import { createRetireeRepository, createKeyRepository } from '@/src/db/factory';
import { sessionWithEntity } from '@/src/actions/auth';
import { redirect, notFound } from 'next/navigation';
import { getCurrentSignatoryRole, getNextStatus, canSign } from '@/src/lib/workflows';
import { submitForm } from "@/src/actions/form"
import { RETIREE_WORKFLOW } from '@/src/lib/workflows/retiree-flow';
import { revalidatePath } from 'next/cache';
import RetireeView from '@/components/ui/retiree/RetireeView';

const RetireeRepo = createRetireeRepository(process.env.DATABASE_TYPE || 'postgres')
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function RetireeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await sessionWithEntity();
    if (!session) redirect('/login');

    const data = await RetireeRepo.getRetireesFormById(id);
    if (!data) return notFound();

    // Workflow Logic
    const workflow = RETIREE_WORKFLOW;
    const currentStatus = data.auth_status ?? "draft";
    
    const currentSignatoryRole = getCurrentSignatoryRole(currentStatus, workflow);
    const userCanSign = currentSignatoryRole
        ? canSign(currentStatus, session.user.access_level, session.user.workflow_role ?? "", currentSignatoryRole, workflow)
        : false;

    const nextStatus = getNextStatus(currentStatus, workflow, 'submit') || "approved"

    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(data.id ?? "", session.user.id);
    const allSignatures = await KeyRepo.getSignatoriesByFormId(data.id ?? "");

    // Server Actions
    const updateAuthStatus = async () => {
        "use server"
        if (data.auth_status !== 'draft') return;
        await submitForm(data.id ?? "", data, session.user.id, data.entity_id, 'retirees_list', nextStatus)
        revalidatePath(`/forms/retirees/${id}`);
    };

    const deleteFormAction = async (formId: string) => {
        "use server"
        if (data.auth_status !== 'draft') return;
        await RetireeRepo.deleteRetireeForm(formId);
        redirect('/forms/retirees')
    }

    return (
        <RetireeView 
            data={data}
            session={session}
            userCanSign={userCanSign}
            currentSignatoryRole={currentSignatoryRole}
            existingSignature={existingSignature}
            allSignatures={allSignatures}
            updateAuthStatus={updateAuthStatus}
            deleteFormAction={deleteFormAction}
        />
    );
}