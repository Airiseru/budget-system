import BP205EntryGrid from "@/components/ui/retiree/RetireeForm";
import BackButton from "@/components/ui/BackButton";
import { sessionWithEntity } from "@/src/actions/auth";
import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { headers } from "next/headers";
import { Button } from '@/components/ui/button'
import { ButtonGroup } from "@/components/ui/button-group"
import Link from "next/link";
import { ModeToggle } from "@/components/ui/system-toggle";

export default async function NewRetireeFormPage() {
    const session = await sessionWithEntity();
    if (!session) redirect('/login');

    if (!session || session.user.access_level !== 'encode') {
        redirect('/forms/retirees?error=unauthorized');
    }

    return (
        <main className="m-4">
            <ButtonGroup className='my-4'>
                <ModeToggle/>
                <ButtonGroup>
                    <Link href="/home">
                        <Button variant="outline" aria-label="Go Back">Go Back</Button>
                    </Link>
                </ButtonGroup>
            </ButtonGroup>
            {/* Pass the entityId here */}
            <BP205EntryGrid entityId={session.user.entity_id} entityName={session.user_entity.entity_name || "Unknown Agency"}  />
        </main>
    );
}
        
        