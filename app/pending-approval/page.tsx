'use client'

import { LogoutButton } from "@/components/ui/LogoutButton";
import { ShieldAlert, Info } from "lucide-react";

export default function PendingApprovalPage() {
    return (
        <main className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
            
            <div className="max-w-md w-full bg-card p-8 rounded-xl shadow-sm border border-gray-200 dark:border-border text-center space-y-6">
                
                <div className="flex justify-center text-amber-500">
                    <ShieldAlert size={64} strokeWidth={1.5} />
                </div>
                
                <div className="space-y-2">
                    {/* Changed text-gray-900 to text-foreground */}
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Verification Required
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Your account has been created successfully, but your access level has not yet been authorized.
                    </p>
                </div>
  
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200 text-left">
                    <p className="flex gap-2 items-start">
                        <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
                        <span>
                            <strong>Next Step:</strong> Please contact your Agency Representative or the DBM System Administrator to verify your identity and assign your official role.
                        </span>
                    </p>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">
                        Waiting for approval? You can safely log out for now.
                    </p>
                    <div className="flex justify-center">
                        <LogoutButton />
                    </div>
                </div>

            </div>
        </main>
    );
}