import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { redirect } from "next/navigation";
import { sessionDetails } from "@/src/actions/auth";
import { HomeButton } from "@/components/ui/HomeButton";

export default async function HomePage() {
    const session = await sessionDetails();

    if (!session) {
        return redirect("/login");
    } else if (session.user.role === "unverified") {
        return redirect("/pending-approval");
    }

    return (
        <main className="m-4">
            <h1></h1>
            <div className="flex gap-2">
                <Button variant="outline">
                    <Link href="/paps/">PAPs</Link>
                </Button>
                <Button variant="outline">
                    <Link href="/forms/proposals/">
                        Form 202/203 (Project Proposals)
                    </Link>
                </Button>
                <Button variant="outline">
                    <Link href="/forms/staff/">Form 204 (Staffing)</Link>
                </Button>
                <Button variant="outline">
                    <Link href="/forms/retirees/">Form 205 (Retiree)</Link>
                </Button>
                <Button variant="outline">
                    <Link href="/home/settings/">Settings</Link>
                </Button>
                <LogoutButton></LogoutButton>
                <HomeButton url="/home"></HomeButton>
            </div>
        </main>
    );
}
