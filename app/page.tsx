import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { sessionWithEntity } from "@/src/actions/auth"
import Link from "next/link";

export default async function Home() {
	const session = await sessionWithEntity()

	if (session?.user.role === 'admin') {
        redirect('/admin')
    }

    if (session?.user.role === 'unverified') {
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
