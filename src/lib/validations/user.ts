import * as z from 'zod'

export const SignupFormSchema = z.object({
    name: z.string().min(2, { error: "Name must be at least 2 characters" }).trim(),
    email: z.email({ error: 'Please enter a valid email.' }).trim(),
    password: z
        .string()
        .min(8, { error: "Be at least 8 characters long" })
        .regex(/[a-z]/, { error: "Contain at least one lowercase letter" })
        .regex(/[A-Z]/, { error: "Contain at least one uppercase letter" })
        .regex(/\d/, { error: "Contain at least one number" })
        .regex(/[^a-zA-Z0-9]/, { error: "Contain at least one special character" })
        .trim(),
    position: z.string().min(2, { error: "Position must be at least 2 characters" }).trim()
})

export const LoginFormSchema = z.object({
    email: z.email({ message: "Please enter a valid email address." }),
    password: z.string().min(1, { message: "Password is required." }),
    rememberMe: z.string().optional()
})

export type UserFormState =
    {
        formErrors?: string[]
        fieldErrors?: {
            name?: string[]
            email?: string[]
            password?: string[]
            position?: string[]
            entity_id?: string[]
            rememberMe?: string[]
        }
        values?: {
            name?: string
            email?: string
            position?: string
            entity_id?: string
            rememberMe?: boolean
        }
    } | undefined