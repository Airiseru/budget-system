"use client"

import { useRouter } from "next/navigation"
import { signup } from "@/app/actions/auth"
import { useActionState } from "react"

export default function SignUpPage() {
    const router = useRouter()
    const [state, action, pending] = useActionState(signup, undefined)

    return (
        <div className="max-w-full p-8 flex h-screen items-center justify-center flex-col">
            <div className="max-w-lg w-full">
                <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
            </div>
            <form action={action} className="space-y-4 w-full  max-w-lg">
                <div className="space-y-2">
                    <label htmlFor="name">Full Name</label>
                    <input id="name" name="name" placeholder="Full Name" defaultValue={state?.values?.name ?? ''} className="border px-3 py-2 w-full rounded my-1" required autoComplete="off" />
                    {state?.fieldErrors?.name && (
                        <p className="text-red-500 text-sm italic">{state.fieldErrors.name[0]}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" placeholder="Email" defaultValue={state?.values?.email ?? ''} className="border px-3 py-2 w-full rounded my-1" required autoComplete="off" />
                    {state?.fieldErrors?.email && (
                        <p className="text-red-500 text-sm italic">{state.fieldErrors.email[0]}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label htmlFor="password">Password</label>
                    <input id="password" name="password" type="password" placeholder="Password" className="border px-3 py-2 w-full rounded my-1" required autoComplete="off" />
                    {state?.fieldErrors?.password && (
                        <div className="text-red-500 text-sm italic">
                            <p>Password must:</p>
                            <ul className="mx-5">
                                {state.fieldErrors.password.map((error) => (
                                    <li key={error} className="text-red-500 text-sm mt-1 list-disc">{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {state?.formErrors && (
                    <p className="text-red-500 italic">{state.formErrors[0]}</p>
                )}

                <div className="mt-5 flex gap-2">
                    <button type="submit" disabled={pending} className="bg-accent-foreground text-white px-4 py-2 rounded w-full disabled:opacity-50">
                        {pending ? 'Signing up...' : 'Sign Up'}
                    </button>

                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded w-full"
                    >
                        Go Back
                    </button>
                </div>
            </form>
        </div>
    )
}