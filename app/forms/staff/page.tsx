import { createStaffingRepository } from '@/src/db/factory'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from "@/components/ui/button-group"
import { ModeToggle } from "@/components/ui/system-toggle"
import Link from "next/link"
import { sessionWithEntity } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS } from '@/src/lib/constants'

export const dynamic = 'force-dynamic';

const StaffingRepo = createStaffingRepository(process.env.DATABASE_TYPE || 'postgres')

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    pending_personnel: 'secondary',
    pending_budget: 'secondary',
    pending_agency_head: 'secondary',
    approved: 'default',
}

export default async function StaffingPage() {
    const session = await sessionWithEntity()

    if (!session) {
        return redirect('/login')
    }

    try {
        const data = await StaffingRepo.getAllStaffingSummaries(
            session.user.id ?? '',
            session.user_entity.entity_type ?? '',
            session.user.entity_id ?? ''
        ) 
    
        if (data.length === 0) {
            return (
                <div className='m-4'>
                    <ButtonGroup className='my-4'>
                        <ModeToggle />
                        <ButtonGroup>
                            <Link href="/home">
                                <Button variant="outline" aria-label="Home">Home</Button>
                            </Link>
                        </ButtonGroup>
                        {session?.user.access_level === 'encode' && (
                        <ButtonGroup>
                            <Link href="/forms/staff/new">
                                <Button variant="outline">Create New Staffing Form</Button>
                            </Link>
                        </ButtonGroup>
                        )}
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
                            <Button variant="outline" aria-label="Home">Home</Button>
                        </Link>
                    </ButtonGroup>
                    {session?.user.access_level === 'encode' && (
                    <ButtonGroup>
                        <Link href="/forms/staff/new">
                            <Button variant="outline">Create New Staffing Form</Button>
                        </Link>
                    </ButtonGroup>
                    )}
                </ButtonGroup>

                <h1 className="text-2xl font-bold mb-6">Staffing Submissions</h1>
                <div className="grid gap-4">
                    {data.map((summary) => (
                        <Link href={`/forms/staff/${summary.id}`} key={summary.id}>
                            <div className="border rounded-lg p-4 hover:bg-accent transition-colors">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <h2 className="font-bold text-lg">FY {summary.fiscal_year} Staffing Plan</h2>
                                        <Badge 
                                            variant={statusColors[summary.auth_status ?? 'draft'] ?? 'outline'}
                                            className={
                                                summary.auth_status === 'approved' 
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                                : ''
                                            }
                                        >
                                            {STATUS_LABELS[summary.auth_status ?? 'draft'] ?? summary.auth_status}
                                        </Badge>
                                    </div>

                                    <span className="text-sm text-muted-foreground shrink-0">
                                        {new Date(summary.submission_date).toLocaleDateString()}
                                    </span>
                                </div>
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