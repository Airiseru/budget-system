import BackButton from "@/components/ui/BackButton"

export default function NewEntity() {
    return (
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-secondary-foreground my-4">New Entity</h1>
            <BackButton url="/admin/entities" className="bg-gray-200 text-gray-700 px-4 py-2 rounded w-full" />
        </div>
    )
}