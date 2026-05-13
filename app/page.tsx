import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { sessionWithEntity } from "@/src/actions/auth"
import { isAdminUser, isUnverifiedUser } from "@/src/lib/user-status"
import Link from "next/link";

export default async function Home() {
	const session = await sessionWithEntity()

	if (session && isAdminUser(session.user)) {
        redirect('/admin')
    }

    if (session && isUnverifiedUser(session.user)) {
        redirect('/pending-approval')
    }

	if (session) {
		redirect('/home')
	}

	return (
		<main className="m-4">
			<div className="flex gap-2">
				<Button variant="outline">
				<Link href="/signup/">Sign Up</Link>
				</Button>
				<Button variant="outline">
				<Link href="/login/">Login</Link>
				</Button>
			</div>
		</main>
	);
}
