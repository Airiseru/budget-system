"use server"

import { SignupFormSchema, UserFormState } from "../lib/user-definitions"
import { auth } from "@/src/lib/auth"
import { redirect } from "next/navigation"
import * as z from 'zod'

export async function signup(state: UserFormState, formData: FormData): Promise<UserFormState> {
    // Validate form fields
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const position = formData.get('position') as string
    const entity_id = formData.get('entity_id') as string

    const submittedValues = { name, email, position, entity_id }

    const validatedFields = SignupFormSchema.safeParse({ name, email, password, position })

    if (!validatedFields.success) {
        return {
            ...z.flattenError(validatedFields.error),
            values: submittedValues
        }
    }

    const response = await auth.api.signUpEmail({
        body: {
            email: email,
            password: password,
            name: name,
            entity_id: entity_id,
            position: position
        },
        asResponse: true
    })

    if (response.status !== 200) {
        return {
            formErrors: [ response.statusText ],
            values: submittedValues
        }
    }

    // Redirect to login page
    redirect('/login')
}