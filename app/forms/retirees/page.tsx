// app/forms/retirees/page.tsx
import { createRetireeRepository } from '@/src/db/factory'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from "@/components/ui/button-group"
import { ModeToggle } from "@/components/ui/system-toggle"
import Link from "next/link"
import { sessionWithEntity } from '@/src/actions/auth'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic';

// Using the retiree repository instead of staffing
const RetireeRepo = createRetireeRepository(process.env.DATABASE_TYPE || 'postgres')

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    pending_personnel: 'secondary',
    pending_budget: 'secondary',
    pending_agency_head: 'secondary',
    approved: 'default',
}

const statusLabels: Record<string, string> = {
    draft: 'Draft',
    pending_personnel: 'Pending Personnel Officer',
    pending_budget: 'Pending Budget Officer',
    pending_agency_head: 'Pending Agency Head',
    approved: 'Approved',
}

export default async function RetireesPage() {
    const session = await sessionWithEntity()

    if (!session) {
        return redirect('/login')
    }

    try {
        // Fetching all retiree list submissions
        const data = await RetireeRepo.getAllRetireeSubmissions(
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
                                <Button variant="outline" aria-label="Go Back">Go Back</Button>
                            </Link>
                        </ButtonGroup>
                        <ButtonGroup>
                            <Link href="/forms/retirees/new">
                                <Button variant="outline">Create New Retiree Form (BP 205)</Button>
                            </Link>
                        </ButtonGroup>
                    </ButtonGroup>
                    <h1 className="text-xl opacity-50 font-medium">No BP Form 205 submissions found for your entity.</h1>
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
                        <Link href="/forms/retirees/new">
                            <Button variant="outline">Create New Retiree Form (BP 205)</Button>
                        </Link>
                    </ButtonGroup>
                </ButtonGroup>

                <div className="mb-8">
                    <h1 className="text-2xl font-bold">BP Form 205: List of Retirees</h1>
                    <p className="text-sm text-muted-foreground">Manage and track retirement benefit projections.</p>
                </div>

                <div className="grid gap-4">
                    {data.map((list: any) => (
                        <Link href={`/forms/retirees/${list.id}`} key={list.id}>
                            <div className="border rounded-lg p-5 hover:bg-accent transition-all shadow-sm group">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="space-y-1">
                                            <h2 className="font-bold text-lg group-hover:text-primary transition-colors">
                                                FY {list.fiscal_year} Retiree List
                                            </h2>
                                            <p className="text-xs text-muted-foreground">
                                                {list.is_mandatory ? 'Mandatory Submission' : 'Optional Update'}
                                            </p>
                                        </div>
                                        <Badge 
                                            variant={statusColors[list.auth_status ?? 'draft'] ?? 'outline'}
                                            className={
                                                list.auth_status === 'approved' 
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent' 
                                                : ''
                                            }
                                        >
                                            {statusLabels[list.auth_status ?? 'draft'] ?? list.auth_status}
                                        </Badge>
                                    </div>

                                    <div className="text-right flex flex-col items-end gap-1">
                                        <span className="text-sm font-medium">
                                            {new Date(list.submission_date).toLocaleDateString('en-PH', { 
                                                month: 'long', 
                                                day: 'numeric', 
                                                year: 'numeric' 
                                            })}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                            Date Submitted
                                        </span>
                                    </div>
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
                <h1 className="text-red-500 font-bold text-xl">System Error</h1>
                <p className="text-muted-foreground">Failed to load Retiree Forms. Please verify your database migration for BP Form 205.</p>
            </div>
        )
    }
}