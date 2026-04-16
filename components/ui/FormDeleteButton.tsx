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
            "Are you sure you want to delete this? This cannot be undone."
        );

        if (confirmed) {
            await onDelete(id);
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