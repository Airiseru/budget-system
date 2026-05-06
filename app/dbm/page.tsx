import { redirect } from "next/navigation"
import { sessionDetails } from "@/src/actions/auth"
import { HomeButton } from "@/components/ui/HomeButton"
import GeneralButton from "@/components/ui/GeneralButton"

export default async function HomePage() {
    const session = await sessionDetails()

    if (!session) {
        return redirect('/login')
    }
    else if (session.user.role === 'unverified') {
        return redirect('/pending-approval')
    }
    else if (session.user.role !== 'dbm') {
        return redirect('/home')
    }

    const isApprover = session.user.role === 'dbm' && session.user.access_level === 'approve'
    
    return (
        <main className="m-4">
            <h1></h1>
            <div className="flex gap-2">
                <GeneralButton
                    url='/dbm/salary'
                    label='Salary Schedules and Compensations'
                />
                <GeneralButton
                    url='/dbm/forms'
                    label='View All Forms'
                />
                <GeneralButton
                    url='/dbm/paps'
                    label='Manage PAP UACS'
                />
                <GeneralButton
                    url='/dbm/entities'
                    label='Manage Entities'
                />
                <GeneralButton
                    url='/dbm/entity-requests'
                    label='Entity Requests'
                />
                <GeneralButton
                    url='/dbm/uacs'
                    label='Manage UACS Codes'
                />
                {isApprover && (
                    <GeneralButton
                        url='/dbm/settings/cycles'
                        label='Budget Cycles'
                    />
                )}
                <HomeButton url="/home"></HomeButton>
            </div>
        </main>
    );
}
