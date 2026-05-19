"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ProposalForm from "@/components/ui/proposals/ProposalForm";
import { FullProjectProposal } from "@/src/types/project_proposals";
import type { ItemCatalogOption } from "@/src/db/postgres/repositories/itemRepository";
import type { PapOption } from "@/src/db/postgres/repositories/papRepository";
import type { UacsFundingSource } from "@/src/types/uacs";

interface WrapperProps {
    project?: FullProjectProposal;
    type?: "202" | "203";
    userId: string;
    entityName: string;
    entityId: string;
    activeFiscalYear?: number;
    itemCatalogs?: ItemCatalogOption[];
    fundingSources?: UacsFundingSource[];
    existingPaps?: PapOption[];
}

export default function ProposalClientWrapper({
    project,
    type,
    userId,
    entityName,
    entityId,
    activeFiscalYear,
    itemCatalogs,
    fundingSources,
    existingPaps,
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
                        Government Entity: {entityName}
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
                    activeFiscalYear={activeFiscalYear}
                    itemCatalogs={itemCatalogs}
                    fundingSources={fundingSources}
                    existingPaps={existingPaps}
                />
            </div>

            <footer className="text-center text-sm text-muted-foreground/75 pb-2">
                <p>
                    Ensure all required fields marked in the {type} manual are filled before submission.
                </p>
            </footer>
        </div>
    );
}
