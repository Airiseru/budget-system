"use client"

import { useState } from "react"
import { findLocalActiveSigningKey } from "@/src/lib/device-key-store"
import { signData } from "@/src/lib/crypto"
import {
    verifyAndSubmitSignature,
    getUserKeys,
    verifySigningPin,
    prepareSignaturePayload,
} from "@/src/actions/keys"
import { Button } from "@/components/ui/button"
import { PenLine, ShieldCheck, Eye, EyeOff } from "lucide-react"

type Props = {
    formId: string
    tableName: string
    formData: object
    userId: string
    entityId: string
    signatoryRole: string
    fromAuthStatus?: string
    toAuthStatus?: string
    onApproved?: () => void
    allowClosedCycleAction?: boolean
    disabled?: boolean
    disabledMessage?: string
}

type Step = "idle" | "pin" | "signing" | "signed"

export function SignButton({
    formId,
    tableName,
    formData,
    signatoryRole,
    fromAuthStatus,
    toAuthStatus,
    onApproved,
    allowClosedCycleAction = false,
    disabled = false,
    disabledMessage,
}: Props) {
    const [step, setStep] = useState<Step>("idle")
    const [pin, setPin] = useState("")
    const [showPin, setShowPin] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleApprove() {
        setError(null)

        if (pin.length !== 6) {
            setError("Please enter your 6-digit PIN.")
            return
        }

        setStep("signing")

        try {
            // Verify if PIN is correct
            if (!(await verifySigningPin(pin))) {
                setError("Incorrect PIN")
                setStep("pin")
                return
            }

            const keys = await getUserKeys()
            const activeKeys = keys.filter((k) => k.status === "active")
            const localSigningKey = await findLocalActiveSigningKey(keys)

            if (activeKeys.length === 0) {
                setError(
                    "No active digital signature key. Please register or renew your device key.",
                )
                setStep("pin")
                return
            }

            if (!localSigningKey) {
                setError(
                    "No digital signature key found for this registered device. Please use correct device for this key or register this device.",
                )
                setStep("pin")
                return
            }

            const { key: activeKey, privateKey } = localSigningKey

            const prepared = await prepareSignaturePayload({
                tableName,
                formId,
                formData,
                eventType: "SIGN",
                fromStatus: fromAuthStatus ?? signatoryRole,
                toStatus: toAuthStatus ?? "approved",
            })

            const output = await signData(prepared.signaturePayload, privateKey, true)
            const signature = output.signature

            await verifyAndSubmitSignature(
                pin,
                tableName,
                formId,
                prepared.payload,
                activeKey.id,
                activeKey.public_key,
                new Date(prepared.changedAt),
                signatoryRole,
                signature,
                prepared.signaturePayload,
                allowClosedCycleAction,
            )

            setStep("signed")
            setPin("")
            onApproved?.()
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to approved. Please try again.",
            )
            setStep("pin")
            setPin("")
        }
    }

    if (step === "signed") {
        return (
            <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-sm font-medium">Signed</span>
            </div>
        )
    }

    if (step === "idle") {
        return (
            <div className="space-y-2">
                <Button
                    onClick={() => setStep("pin")}
                    disabled={disabled}
                    className="gap-2 bg-accent-foreground text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-accent-foreground/80"
                >
                    <PenLine className="h-4 w-4" />
                    Sign Document
                </Button>
                {disabled && disabledMessage ? (
                    <p className="text-xs text-muted-foreground">{disabledMessage}</p>
                ) : null}
            </div>
        )
    }

    return (
        <div className="border border-border rounded-lg p-4 space-y-3 max-w-sm">
            <div>
                <p className="font-medium text-sm">Enter your signing PIN</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Enter your 6-digit PIN to confirm your signature.
                </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="relative">
                <input
                    type={showPin ? "text" : "password"}
                    value={pin}
                    onChange={(e) =>
                        setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit PIN"
                    className="border px-3 py-2 w-full rounded bg-background font-mono pr-10 tracking-widest"
                    maxLength={6}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleApprove()}
                />
                <button
                    type="button"
                    onClick={() => setShowPin((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    {showPin ? (
                        <EyeOff className="h-4 w-4" />
                    ) : (
                        <Eye className="h-4 w-4" />
                    )}
                </button>
            </div>

            <div className="flex gap-2">
                <Button
                    onClick={handleApprove}
                    disabled={pin.length !== 6 || step === "signing"}
                    className="flex-1 bg-accent-foreground text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-accent-foreground/80"
                >
                    {step === "signing" ? "Signing..." : "Confirm Signature"}
                </Button>
                <Button
                    variant="outline"
                    onClick={() => {
                        setStep("idle")
                        setPin("")
                        setError(null)
                    }}
                    disabled={step === "signing"}
                >
                    Cancel
                </Button>
            </div>
        </div>
    )
}
