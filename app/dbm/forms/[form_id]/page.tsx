import { createFormRepository } from '@/src/db/factory'
import { FORM_ROUTE_MAP } from '@/src/lib/constants'
import { redirect, notFound } from 'next/navigation'
import { sessionWithEntity } from '@/src/actions/auth'
import BackButton from '@/components/ui/BackButton'

const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function DBMFormRouter({ params }: { params: Promise<{ form_id: string }> }) {
    const session = await sessionWithEntity()
    if (!session || session.user.role !== 'dbm') redirect('/login')

    const { form_id } = await params;

    const form = await FormRepository.getFormById(form_id)
    
    if (!form) return notFound()

    // Retrieve correct path
    if (form.type === 'nep' || form.type === 'gaa') {
        redirect(`/dbm/allocations?year=${form.fiscal_year}`)
    }

    const basePath = FORM_ROUTE_MAP[form.type]
    
    if (!basePath) {
        // Fallback for unknown form types
        return (
            <div className="p-8 text-center text-red-600">
                <BackButton />
                <h1 className="font-bold text-xl">Unknown Form Type</h1>
                <p>The system does not know how to route form type: {form.type}</p>
            </div>
        )
    }

    // Redirect user to the correct view
    redirect(`${basePath}/${form_id}`)
}
