import BP205EntryGrid from "@/components/ui/retiree/RetireeForm";
import BackButton from "@/components/ui/BackButton";
import { sessionWithEntity } from "@/src/actions/auth";
import { redirect } from "next/navigation";

export default async function NewRetireeFormPage() {
    const session = await sessionWithEntity();
    if (!session) redirect('/login');

    return (
        <main className="p-6 max-w-8xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold mb-4">New BP Form 205 Submission</h1>
            </div>

            {/* Pass the entityId here */}
            <BP205EntryGrid entityId={session.user.entity_id} />
        </main>
    );
}
        
        