"use client";

import { Workflow, getNextStatus } from "@/src/lib/workflows";
import { SignButton } from "./SignButton";
import { RejectButton } from "./RejectButton";
import { SignatureVerificationBadge } from "./SignatureVerificationBadge";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { WORKFLOW_ROLE_LABELS, STATUS_MESSAGES } from "@/src/lib/constants";

type Props = {
    formId: string;
    tableName: string;
    formData: object;
    userId: string;
    entityId: string;
    authStatus: string;
    statusMessage?: string;
    userCanSign: boolean;
    signatoryRole?: string;
    nextSignatoryRole?: string;
    alreadySigned: boolean;
    signatories?: {
        id: string;
        user_name: string;
        role: string;
        created_at: Date;
    }[];
    pastSignatories?: {
        id: string;
        user_name: string;
        role: string;
        created_at: Date;
    }[];
    latestRejection?: {
        remarks: string | null;
        changed_at: Date;
        user_name: string | null;
    } | null;
    workflow: Workflow;
};

export function SignSection({
    formId,
    tableName,
    formData,
    userId,
    entityId,
    authStatus,
    statusMessage,
    userCanSign,
    signatoryRole,
    alreadySigned,
    signatories = [],
    pastSignatories = [],
    latestRejection,
    workflow,
}: Props) {
    const shouldShowLatestRejection =
        !!latestRejection?.remarks && signatories.length === 0;
    const shouldShowPastSignatures =
        shouldShowLatestRejection && pastSignatories.length > 0;

    return (
        <div className="border border-border rounded-lg p-6 space-y-4">
            <h3 className="font-semibold text-lg">Signatures</h3>

            {/* status message */}
            <p className="text-sm text-muted-foreground">
                {statusMessage ?? STATUS_MESSAGES[authStatus] ?? authStatus}
            </p>

            {shouldShowLatestRejection && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-1">
                    <p className="text-sm font-semibold text-red-900">
                        Latest rejection remarks
                    </p>
                    <p className="text-sm text-amber-950 whitespace-pre-wrap">
                        {latestRejection.remarks}
                    </p>
                    <p className="text-xs text-red-800">
                        {latestRejection.user_name
                            ? `${latestRejection.user_name} rejected this form`
                            : "This form was rejected"}{" "}
                        on{" "}
                        {new Intl.DateTimeFormat("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                        }).format(new Date(latestRejection.changed_at))}
                    </p>
                </div>
            )}

            {/* existing signatures */}
            {signatories.length > 0 && (
                <div className="space-y-2">
                    {signatories.map((sig) => (
                        <SignatureVerificationBadge
                            entityId={entityId}
                            formId={formId}
                            tableName={tableName}
                            key={sig.id}
                            signatoryId={sig.id}
                            formData={formData}
                            signerName={`${sig.user_name} (${WORKFLOW_ROLE_LABELS[sig.role] ?? sig.role})`}
                            signedAt={sig.created_at}
                        />
                    ))}
                </div>
            )}

            {shouldShowPastSignatures && (
                <details className="rounded-lg border border-border bg-muted/20">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
                        <span>Past signatures</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </summary>
                    <div className="space-y-2 border-t border-border px-4 py-3">
                        {pastSignatories.map((sig) => (
                            <div
                                key={sig.id}
                                className="rounded-lg border border-border p-3"
                            >
                                <p className="text-sm font-medium">
                                    {sig.user_name} (
                                    {WORKFLOW_ROLE_LABELS[sig.role] ?? sig.role}
                                    )
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Signed{" "}
                                    {new Date(sig.created_at).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </details>
            )}

            {/* sign button */}
            {alreadySigned ? (
                <div className="flex items-center gap-2 text-emerald-600">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-sm font-medium">
                        You have already signed this document as{" "}
                        {WORKFLOW_ROLE_LABELS[signatoryRole ?? ""] ??
                            signatoryRole}
                    </span>
                </div>
            ) : userCanSign && signatoryRole ? (
                <div className="space-y-2">
                    <p className="text-sm font-medium">
                        Sign as {WORKFLOW_ROLE_LABELS[signatoryRole]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <SignButton
                            entityId={entityId}
                            tableName={tableName}
                            formId={formId}
                            formData={formData}
                            userId={userId}
                            signatoryRole={signatoryRole}
                            fromAuthStatus={authStatus}
                            toAuthStatus={
                                getNextStatus(
                                    authStatus,
                                    workflow,
                                    "approve",
                                ) ?? ""
                            }
                        />
                        {getNextStatus(authStatus, workflow, "reject") && (
                            <RejectButton
                                entityId={entityId}
                                tableName={tableName}
                                formId={formId}
                                formData={formData}
                                userId={userId}
                                signatoryRole={signatoryRole}
                                fromAuthStatus={authStatus}
                                toAuthStatus={
                                    getNextStatus(
                                        authStatus,
                                        workflow,
                                        "reject",
                                    ) ?? ""
                                }
                            />
                        )}
                    </div>
                </div>
            ) : authStatus !== "approved" ? (
                <p className="text-sm text-muted-foreground italic">
                    You are not authorized to sign at this stage.
                </p>
            ) : null}
        </div>
    );
}
