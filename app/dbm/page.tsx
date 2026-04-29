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
                <HomeButton url="/home"></HomeButton>
            </div>
        </main>
    );
}
