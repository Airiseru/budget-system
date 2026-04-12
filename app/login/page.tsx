"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import { logUserLogin } from "@/src/actions/audit";
import BackButton from "@/components/ui/BackButton";
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const rememberMe = formData.get('rememberMe') === 'on'

        const { data, error } = await authClient.signIn.email({
            email,
            password,
            rememberMe
        });

        if (error) {
            setError(error.message || "Invalid email or password. Please try again.")
            setIsLoading(false)
            return
        }

        // Log user login
        if (data?.user?.id && data?.user?.entity_id) {
            const auditLog = await logUserLogin(data.user.id, data.user.entity_id)

            if (!auditLog?.success) {
                setError("Login succeeded, but the security audit log failed. Please contact IT.");
                setIsLoading(false);
                return; // Block entry if the black box is broken
            }
        }

        // Route the user based on the role
        if (data?.user?.role === 'admin') {
            router.push('/admin')
        } else {
            router.push('/home')
        }
    }

    return (
        <div className="max-w-full p-8 flex h-screen items-center justify-center flex-col">
            <div className="max-w-lg w-full">
                <h1 className="text-2xl font-bold mb-4">Login</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-lg">
                
                {/* Global Form Errors */}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        <p className="text-red-500 italic">{error}</p>
                    </div>
                )}
                
                <div className="space-y-2">
                    <label htmlFor="email">Email</label>
                    <input 
                        id="email" 
                        name="email" 
                        type="email" 
                        placeholder="Email" 
                        className="border px-3 py-2 w-full rounded my-1" 
                        autoComplete="email" 
                        required 
                    />
                </div>

                <div>
                    <label htmlFor="password">Password</label>
                    <div className="relative">
                        <input 
                            id="password" 
                            name="password" 
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password" 
                            className="border px-3 py-2 w-full rounded my-1" 
                            autoComplete="current-password" 
                            required 
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(prev => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <div className="mb-4 flex items-center">
                    <input 
                        id="rememberMe" 
                        name="rememberMe" 
                        type="checkbox" 
                        className="mr-2" 
                    />
                    <label htmlFor="rememberMe">Remember me</label>
                </div>

                <div className="flex gap-2">
                    <BackButton url='/' className="bg-gray-200 text-gray-700 px-4 py-5 rounded w-1/2 text-md" variant="default" />

                    <Button 
                        type="submit" 
                        disabled={isLoading} 
                        variant="outline"
                        className="w-1/2 rounded py-5 text-md disabled:opacity-50 bg-accent-foreground text-white border border-accent-foreground hover:bg-accent-foreground/50" 
                    >
                        {isLoading ? 'Logging in...' : 'Login'}
                    </Button>
                </div>
            </form>
        </div>
    );
}