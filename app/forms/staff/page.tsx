import { createStaffingRepository } from '@/src/db/factory' // or createStaffingRepository
import { Button } from '@/components/ui/button'
import { ButtonGroup } from "@/components/ui/button-group"
import { ModeToggle } from "@/components/ui/system-toggle"
import Link from "next/link"
import { sessionDetails } from '@/src/actions/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic';

// If you put the functions in PapRepository, keep this. 
// If you made a separate one, use createStaffingRepository.
const StaffingRepo = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')

export default async function StaffingPage() {
    const session = await sessionDetails()

    if (!session) {
        return redirect('/login')
    }

    try {
        // You'll need to ensure this method exists in your repository 
        // to fetch all staffing summaries for the dashboard
        const data = await StaffingRepo.getAllStaffingSummaries() 
    
        if (data.length === 0) {
            return (
                <div className='m-4'>
                    <ButtonGroup className='my-4'>
                        <ModeToggle />
                        <ButtonGroup>
                            <Link href="/home">
                                <Button variant="outline" aria-label="Go Back">Go Back</Button>
                            </Link>
                        </ButtonGroup>
                        <ButtonGroup>
                            <Link href="/forms/staff/new">
                                <Button variant="outline">Create New Staffing Form</Button>
                            </Link>
                        </ButtonGroup>
                    </ButtonGroup>
                    <h1 className="text-xl opacity-50">No Staffing Forms submitted yet.</h1>
                </div>
            )
        }
    
        return (
            <div className='m-4'>
                <ButtonGroup className='my-4'>
                    <ModeToggle />
                    <ButtonGroup>
                        <Link href="/home">
                            <Button variant="outline" aria-label="Go Back">Go Back</Button>
                        </Link>
                    </ButtonGroup>
                    <ButtonGroup>
                        <Link href="/forms/staff/new">
                            <Button variant="outline">Create New Staffing Form</Button>
                        </Link>
                    </ButtonGroup>
                </ButtonGroup>

                <h1 className="text-2xl font-bold mb-6">Staffing Submissions</h1>
                <div className="grid gap-4">
                    {data.map((summary) => (
                        <Link href={`/forms/staff/${summary.id}`} key={summary.id}>
                            <div className="border rounded-lg p-4 hover:bg-accent transition-colors">
                                <div className="flex justify-between items-center">
                                    <h2 className="font-bold text-lg">FY {summary.fiscal_year} Staffing Plan</h2>
                                    <span className="text-sm text-muted-foreground">
                                        {new Date(summary.submission_date).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-sm opacity-80 mt-1">
                                    Signed by: {summary.digital_signature}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        )
    } catch (e) {
        console.error(e)
        return (
            <div className="m-4">
                <h1 className="text-red-500 font-bold">Error loading Staffing Forms</h1>
                <p>Please check your database connection.</p>
            </div>
        )
    }
}