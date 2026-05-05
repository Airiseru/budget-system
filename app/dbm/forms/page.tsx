import { createFormRepository } from '@/src/db/factory'
import { sessionWithEntity } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import AllFormView from '@/components/ui/dbm/AllFormView'

export const dynamic = 'force-dynamic'

const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

type DBMFormsSearchParams = Promise<{
    page?: string
    year?: string
    status?: string
    type?: string
}>

export default async function DBMFormsPage({ searchParams }: { searchParams: DBMFormsSearchParams }) {
    const session = await sessionWithEntity()

    if (!session) {
        return redirect('/login')
    }

    if (session.user.role !== 'dbm') {
        return redirect('/home')
    }

    const params = await searchParams;

    const page = Number(params.page) || 1
    const limit = 15
    const offset = (page - 1) * limit

    const selectedYear = params.year ? Number(params.year) : undefined
    const selectedStatus = params.status || ''
    const selectedType = params.type || ''

    const {forms, totalPages} = await FormRepository.getAllForms({
        fiscal_year: selectedYear,
        auth_status: selectedStatus || undefined,
        type: selectedType || undefined,
        limit,
        offset
    })

    return (
        <AllFormView 
            forms={forms}
            page={page}
            totalPages={totalPages}
            selectedYear={selectedYear}
            selectedStatus={selectedStatus}
            selectedType={selectedType}
        />
    )
}
