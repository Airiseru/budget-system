"use server"

import { SignupFormSchema, UserFormState } from "../lib/user-definitions"
import { createEntityRepository } from '@/src/db/factory'
import { auth } from "@/src/lib/auth"
import { redirect } from "next/navigation"
import * as z from 'zod'

export async function signup(state: UserFormState, formData: FormData): Promise<UserFormState> {
    // Validate form fields
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const validatedFields = SignupFormSchema.safeParse({ name, email, password })

    if (!validatedFields.success) {
        return {
            ...z.flattenError(validatedFields.error),
            values: { name, email }
        }
    }

    const entityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    const entity = await entityRepository.createEntity({ type: 'user' })

    const response = await auth.api.signUpEmail({
        body: {
            email: email,
            password: password,
            name: name,
            entity_id: entity.id,
        },
        asResponse: true
    })

    if (response.status !== 200) {
        await entityRepository.deleteEntity(entity.id)
        return {
            formErrors: [ response.statusText ]
        }
    }

    // Redirect to login page
    redirect('/login')
}