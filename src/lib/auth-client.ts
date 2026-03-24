import { createAuthClient } from "better-auth/client"
import { inferAdditionalFields } from 'better-auth/client/plugins'
import type { auth } from "@/src/lib/auth"

export const authClient = createAuthClient({
    baseURL: process.env.BETTER_AUTH_URL,
    plugins: [
        inferAdditionalFields<typeof auth>()
    ]
})
