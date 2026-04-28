"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import ProposalForm from "@/components/ui/proposals/ProposalForm";

interface WrapperProps {
    project?: any; // <--- Add this line
    type?: "202" | "203";
    userId: string;
    entityName: string;
    entityId: string;
}

export default function ProposalClientWrapper({
    project,
    type,
    userId,
    entityName,
    entityId,
}: WrapperProps) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const searchType = (searchParams.get("type") as "202" | "203") || "202";

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
                <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 hover:bg-transparent"
                            onClick={() => router.back()}
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back to List
                        </Button>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Create New BP {type || searchType}
                    </h1>
                    <p className="text-muted-foreground italic">
                        Agency: {entityName}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => router.back()}>
                        Cancel
                    </Button>
                </div>
            </div>

            <div className="mt-8">
                <ProposalForm
                    project={project}
                    type={type || searchType}
                    userId={userId}
                    entityName={entityName}
                    entityId={entityId}
                />
            </div>

            <footer className="text-center text-xs text-muted-foreground pt-10">
                <p>
                    Ensure all required fields marked in the {type} manual are
                    filled before submission.
                </p>
            </footer>
        </div>
    );
}
