'use client'

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface FormDeleteButtonProps {
    id: string;
    onDelete: (id: string) => Promise<void>;
}

export default function FormDeleteButton({ id, onDelete }: FormDeleteButtonProps) {
    const router = useRouter();

    const handleDelete = async () => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this staffing plan? This cannot be undone."
        );

        if (confirmed) {
            try {
                await onDelete(id);
                // The server action handles the redirect, but as a backup:
                router.push('/forms/staff');
            } catch (error) {
                alert("Failed to delete the form. Please try again.");
                console.log(error)
            }
        }
    };

    return (
        <button
            onClick={handleDelete}
            className="flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded hover:bg-destructive/90 transition-all font-medium text-white"
        >
            <Trash2 className="w-4 h-4" />
            Delete
        </button>
    );
}