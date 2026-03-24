'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";

export default function LoginPage() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        
        const formData = Object.fromEntries(new FormData(e.currentTarget))
        const email = formData.email as string
        const password = formData.password as string
        const rememberMe = formData.rememberMe as string === 'on'

        try {
            await authClient.signIn.email({
                email: email,
                password: password,
                callbackURL: "/home",
                rememberMe: rememberMe
            }, {
                onRequest: () => {
                    setIsLoading(true)
                    setError(null)
                },
                onSuccess: () => {
                    setIsLoading(false)
                },
                onError: (ctx) => {
                    setError(ctx.error.message)
                    setIsLoading(false)
                },
            })
        } catch (err) {
            setError("Something went wrong")
            setIsLoading(false)
        }
    }

  return (
    <div className="max-w-md mx-auto mt-16">
        <h1 className="text-2xl font-bold mb-6">Login</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="Email" className="border px-3 py-2 w-full rounded" autoComplete="email" required />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="Password" className="border px-3 py-2 w-full rounded" autoComplete="current-password" required />
            <input id="rememberMe" name="rememberMe" type="checkbox" className="mr-2" />
            <label htmlFor="rememberMe">Remember me</label>
            <div className="flex gap-2">
                <button type="submit" disabled={isLoading} className="bg-accent-foreground text-white px-4 py-2 rounded w-full disabled:opacity-50">
                    {isLoading ? 'Logging in...' : 'Login'}
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
  );
}
