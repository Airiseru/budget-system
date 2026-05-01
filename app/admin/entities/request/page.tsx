import { sessionWithEntity } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import { loadAdminEntities } from '@/src/actions/entities'
import BackButton from '@/components/ui/BackButton'
import { EntityRequestForm } from '@/components/ui/admin/EntityRequestForm'
import { createEntityRepository } from '@/src/db/factory'

const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function AdminEntityRequestPage() {
    const session = await sessionWithEntity()
    if (!session) redirect('/login')
    if (session.user.role !== 'admin') redirect('/admin')

    const result = await loadAdminEntities()
    let departments = 'departments' in result ? result.departments : []
    let agencies = 'agencies' in result ? result.agencies : []
    let operatingUnits = 'operatingUnits' in result ? result.operatingUnits : []
    let fixedDepartmentId = ''
    let fixedAgencyId = ''

    if (session.user_entity.entity_type === 'department' && session.user.entity_id) {
        const ownDepartment = await EntityRepository.getDepartmentById(session.user.entity_id).catch(() => null)
        departments = ownDepartment ? [ownDepartment] : departments
        fixedDepartmentId = ownDepartment?.id ?? ''
    }

    if (session.user_entity.entity_type === 'agency' && session.user.entity_id) {
        const ownAgency = await EntityRepository.getAgencyById(session.user.entity_id).catch(() => null)
        agencies = ownAgency ? [ownAgency] : agencies
        fixedAgencyId = ownAgency?.id ?? ''
        fixedDepartmentId = ownAgency?.department_id ?? ''

        if (fixedDepartmentId) {
            const ownDepartment = await EntityRepository.getDepartmentById(fixedDepartmentId).catch(() => null)
            departments = ownDepartment ? [ownDepartment] : departments
        }
    }

    if (session.user_entity.entity_type === 'operating_unit' && session.user.entity_id) {
        const ownOu = await EntityRepository.getOperatingUnitById(session.user.entity_id).catch(() => null)
        operatingUnits = ownOu ? [ownOu] : operatingUnits
        if (ownOu?.agency_id) {
            const ownAgency = await EntityRepository.getAgencyById(ownOu.agency_id).catch(() => null)
            agencies = ownAgency ? [ownAgency] : agencies
            fixedAgencyId = ownAgency?.id ?? ''
            fixedDepartmentId = ownAgency?.department_id ?? ''
        }

        if (fixedDepartmentId) {
            const ownDepartment = await EntityRepository.getDepartmentById(fixedDepartmentId).catch(() => null)
            departments = ownDepartment ? [ownDepartment] : departments
        }
    }

    return (
        <main className="m-6 max-w-2xl md:mx-auto md:my-12 space-y-6">
            <div className="flex items-center justify-between">
                <BackButton url="/admin/entities" />
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Request New Entity</h1>
                    <p className="text-muted-foreground text-sm mt-1">Submit a request for DBM review.</p>
                </div>
                <div className="w-[73px]" />
            </div>

            <EntityRequestForm
                requesterType={session.user_entity.entity_type}
                requesterEntityId={session.user.entity_id ?? ''}
                departments={departments}
                agencies={agencies}
                operatingUnits={operatingUnits}
                fixedDepartmentId={fixedDepartmentId}
                fixedAgencyId={fixedAgencyId}
            />
        </main>
    )
}
