import { betterAuth } from "better-auth"
import { Pool } from 'pg'

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL
    }),
    appName: "BUDGET System",
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
            role: {
                type: ['unverified', 'admin', 'dbm', 'agency'],
                required: true,
                defaultValue: 'unverified',
                input: false,
            },
            entity_id: {
                type: "string",
                required: false,
                input: true
            },
            public_key: {
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
})