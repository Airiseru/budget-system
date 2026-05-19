import { redirect } from 'next/navigation'
import PapForm from '@/components/ui/PapForm'
import { sessionWithEntity } from '@/src/actions/auth'

export const dynamic = 'force-dynamic'

export default async function NewDbmPapPage() {
    const session = await sessionWithEntity()

    if (!session) return redirect('/login')
    if (session.user.role !== 'dbm') return redirect('/home')

    return (
        <PapForm
            entityId={null}
            entityName="Applies to all entities"
            successBasePath="/dbm/paps"
            cancelHref="/dbm/paps"
            defaultProjectStatus="approved"
            defaultProjectType="general_administration_and_support"
            entityLockedLabel="Entity ID (Global PAP)"
        />
    )
}
