import { betterAuth } from "better-auth"
import { Pool } from 'pg'
import { nextCookies } from "better-auth/next-js"

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL
    }),
    appName: "BUDGET System",
    plugins: [
        nextCookies(),
    ],
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        autoSignIn: false,
    },
    user: {
        modelName: "users",
        fields: {
            emailVerified: "email_verified",
            createdAt: "created_at",
            updatedAt: "updated_at"
        },
        additionalFields: {
            position: {
                type: 'string',
                required: true,
                input: true,
            },
            role: {
                type: ['dbm', 'department', 'agency', 'ou', 'others'],
                required: true,
                defaultValue: 'others',
                input: false,
            },
            access_level: {
                type: ['none', 'view', 'encode', 'review', 'approve'],
                required: true,
                defaultValue: 'none',
                input: false,
            },
            workflow_role: {
                type: "string",
                required: false,
                input: false
            },
            is_admin: {
                type: "boolean",
                required: false,
                input: false
            },
            signing_pin_hash: {
                type: "string",
                required: false,
                input: false
            },
            entity_id: {
                type: "string",
                required: true,
                input: true
            },
            status: {
                type: ['unverified', 'active', 'archived', 'suspended'],
                required: false,
                input: false,
                defaultValue: 'unverified'
            },
            archived_at: {
                type: "string",
                required: false,
                input: false
            }
        },
    },
    session: {
        modelName: "sessions",
        fields: {
            userId: "user_id",
            expiresAt: "expires_at",
            ipAddress: "ip_address",
            userAgent: "user_agent",
            createdAt: "created_at",
            updatedAt: "updated_at"
        },
    },
    account: {
        modelName: "accounts",
        fields: {
            userId: "user_id",
            accountId: "account_id",
            providerId: "provider_id",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            accessTokenExpiresAt: "access_token_expires_at",
            refreshTokenExpiresAt: "refresh_token_expires_at",
            idToken: "id_token",
            createdAt: "created_at",
            updatedAt: "updated_at"
        },
    },
    verification: {
        modelName: "verifications",
        fields: {
            expiresAt: "expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at"
        },
    },
    advanced: {
        database: {
            generateId: () => crypto.randomUUID(),
        }
    }
})
