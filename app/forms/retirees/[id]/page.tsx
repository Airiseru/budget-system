import { createRetireeRepository, createFormRepository, createKeyRepository } from '@/src/db/factory';
import { sessionWithEntity } from '@/src/actions/auth';
import { redirect, notFound } from 'next/navigation';
import { getCurrentSignatoryRole } from '@/src/lib/workflows';
import { RETIREE_WORKFLOW } from '@/src/lib/workflows/retiree-flow';
import { canSign } from '@/src/lib/workflows';
import { revalidatePath } from 'next/cache';
import RetireeView from '@/components/ui/retiree/RetireeView';

const RetireeRepo = createRetireeRepository(process.env.DATABASE_TYPE || 'postgres');
const FormRepo = createFormRepository(process.env.DATABASE_TYPE || 'postgres')
const KeyRepo = createKeyRepository(process.env.DATABASE_TYPE || 'postgres')


const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
    approved: 'Approved',
};

export default async function RetireeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await sessionWithEntity();
    if (!session) redirect('/login');

    const data = await RetireeRepo.getRetireesFormById(id);
    if (!data) return notFound();

    // Logic for workflow
    const workflow = RETIREE_WORKFLOW;
    const currentSignatoryRole = getCurrentSignatoryRole(data.auth_status ?? "", workflow);
    const userCanSign = currentSignatoryRole
        ? canSign(data.auth_status ?? "", session.user.access_level, session.user.workflow_role ?? "", currentSignatoryRole, workflow)
        : false;

    const existingSignature = await KeyRepo.getSignatoryByFormIdAndUserId(data.id ?? "", session.user.id);
    const allSignatures = await KeyRepo.getSignatoriesByFormId(data.id ?? "");

    // Server Actions
    const updateAuthStatus = async () => {
        "use server"
        if (data.auth_status !== 'draft') return;
        await FormRepo.updateFormAuthStatus(data.id ?? "", "pending_personnel");
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