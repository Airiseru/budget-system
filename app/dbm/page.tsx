import { redirect } from "next/navigation"
import { sessionDetails } from "@/src/actions/auth"
import { isActiveUser, isUnverifiedUser, isDbmUser } from "@/src/lib/user-status"
import { HomeButton } from "@/components/ui/HomeButton"
import GeneralButton from "@/components/ui/GeneralButton"

export default async function HomePage() {
    const session = await sessionDetails()

    if (!session) {
        return redirect('/login')
    }
    else if (isUnverifiedUser(session.user)) {
        return redirect('/pending-approval')
    }
    else if (!isActiveUser(session.user)) {
        return redirect('/login')
    }
    else if (session.user.role !== 'dbm') {
        return redirect('/home')
    }

    const isApprover = isDbmUser(session.user)
    
    return (
        <main className="m-4">
            <h1>DBM Modules</h1>
            <div className="flex gap-2 flex-wrap">
                <GeneralButton
                    url='/dbm/salary'
                    label='Salary Schedules and Compensations'
                />
                <GeneralButton
                    url='/dbm/forms'
                    label='View All Forms'
                />
                <GeneralButton
                    url='/dbm/proposals'
                    label='Review Project Proposals'
                />
                <GeneralButton
                    url='/dbm/paps'
                    label='Manage PAPs'
                />
                <GeneralButton
                    url='/dbm/tier-one'
                    label='Tier One Allocations'
                />
                <GeneralButton
                    url='/dbm/allocations'
                    label='NEP and GAA Dashboard'
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
                <GeneralButton
                    url='/dbm/items'
                    label='Manage Line Items'
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
