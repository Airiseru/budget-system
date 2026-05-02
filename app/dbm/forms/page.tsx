import { createFormRepository } from '@/src/db/factory'
import { sessionWithEntity } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import BackButton from '@/components/ui/BackButton'
import AllFormView from '@/components/ui/dbm/AllFormView'

export const dynamic = 'force-dynamic'

const FormRepository = createFormRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function DBMFormsPage({ searchParams }: { searchParams: Promise<any> }) {
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

    try {
        const {forms, totalCount, totalPages} = await FormRepository.getAllForms({
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
    } catch (e) {
        console.error(e)
        return (
            <div className="m-6 max-w-7xl mx-auto space-y-4">
                <BackButton url="/dbm/" />
                <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-lg">
                    <h1 className="text-destructive font-bold text-lg">Error loading DBM Forms Module</h1>
                    <p className="text-destructive/80 text-sm mt-1">Please check your database connection or try again later.</p>
                </div>
            </div>
        )
    }
}