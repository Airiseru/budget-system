"use client"

import { createUserEntity, deleteUserEntity } from "@/src/actions/auth"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/src/lib/auth-client"

export default function SignUpPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    // Password check using regex
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const formData = Object.fromEntries(new FormData(e.currentTarget))
        const email = formData.email as string
        const password = formData.password as string
        const name = formData.name as string

        try {
            if (!passwordRegex.test(password)) {
                setError("Password must be at least 8 characters and contain uppercase, lowercase, numbers, and special characters.")
                setIsLoading(false)
                return
            }

            const entity = await createUserEntity()

            const user = await authClient.signUp.email({
                email: email,
                password: password,
                name: name,
                entity_id: entity.id,
                callbackURL: "/login"
            }, {
                onRequest: () => {
                    setIsLoading(true)
                    setError(null)
                },
                onSuccess: () => {
                    router.push("/login")
                    setError(null)
                },
                onError: (ctx) => {
                    deleteUserEntity(entity.id)
                    setError(ctx.error.message)
                }
            })
        } catch (err) {
            setError('Something went wrong')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-md mx-auto mt-16">
            <h1 className="text-2xl font-bold mb-6">Sign Up</h1>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <input name="name" placeholder="Full Name" className="border px-3 py-2 w-full rounded" required autoComplete="off" />
                <input name="email" type="email" placeholder="Email" className="border px-3 py-2 w-full rounded" required autoComplete="off" />
                <input name="password" type="password" placeholder="Password" className="border px-3 py-2 w-full rounded" required autoComplete="off" />
                <div className="flex gap-2">
                    <button type="submit" disabled={isLoading} className="bg-accent-foreground text-white px-4 py-2 rounded w-full disabled:opacity-50">
                        {isLoading ? 'Signing up...' : 'Sign Up'}
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