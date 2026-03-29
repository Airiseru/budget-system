import { Button } from "@/components/ui/button"
import Link from "next/link"
import { HomeButton } from "@/components/ui/HomeButton";

export default function AdminPage() {
    return (
        <main className="m-4">
            <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground my-4">Admin</h1>
            <div className="flex gap-2">
                <Button variant="outline">
                    <Link href="/admin/pending">Pending Approvals</Link>
                </Button>
                <Button variant="outline">
                    <Link href="/admin/entities">Entities</Link>
                </Button>
                <HomeButton url="/home"></HomeButton>
            </div>
        </main>
    );
}