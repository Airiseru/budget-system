import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogoutButton } from "@/components/ui/LogoutButton"
import { redirect } from "next/navigation"
import { sessionDetails } from "@/src/actions/auth"

export default async function HomePage() {
    const session = await sessionDetails()

    if (!session) {
        return redirect('/login')
    }
    
    return (
        <main className="m-4">
            <h1></h1>
            <div className="flex gap-2">
                <Button variant="outline">
                    <Link href="/paps/">PAPs</Link>
                </Button>
                <LogoutButton></LogoutButton>
            </div>
        </main>
    );
}
