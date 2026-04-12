'use server'

import { auth } from "@/src/lib/auth"
import { headers } from "next/headers"
import { createEntityRepository } from "../db/factory"
import { logUserSignUp, logUserLogout } from "./audit"
import { SignupFormSchema, UserFormState } from "../lib/validations/user"
import { redirect } from "next/navigation"
import * as z from 'zod'
import { UserAccessLevels } from "../types/entities"

export async function sessionDetails() {
    return await auth.api.getSession({
        headers: await headers()
    })
}

export async function sessionWithEntity() {
    const session = await sessionDetails()
    if (!session) return null

    const EntityRepository = createEntityRepository(process.env.DATABASE_TYPE || 'postgres')
    const entity = await EntityRepository.getEntityOfUser(session.user.entity_id || '')

    const entityName =
        entity?.entity_type === 'national' ? 'All Entities' :
        entity?.entity_type === 'department' ? entity.department_name :
        entity?.entity_type === 'agency' ? entity.agency_name :
        entity?.entity_type === 'operating_unit' ? entity.operating_unit_name :
        null

    return {
        ...session,
        user_entity: {
            entity_type: entity?.entity_type,
            entity_name: entityName,
        }
    }
}

export async function requireVerifiedUser() {
    const session = await sessionDetails()
    if (!session || session?.user?.role === 'unverified') {
        redirect('/login')
    }
}

export async function redirectBasedOnRole() {
    const session = await sessionDetails()
    if (!session) {
        redirect('/login')
    }
    else if (session.user.role === 'unverified') {
        redirect('/pending-approval')
    }
    else if (session.user.role === 'admin') {
        redirect('/admin')
    }
    else {
        redirect('/home')
    }
}

export async function requireAccessLevel(level: string) {
    const session = await sessionDetails()
    if (!session) redirect('/login')
    if (session.user.access_level !== level) redirect('/home/settings')
    return session
}

export async function requireMinAccessLevel(minimumLevel: string, returnSession: boolean = false) {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    const userLevelIndex = UserAccessLevels.indexOf(session.user.access_level)
    const requiredLevelIndex = UserAccessLevels.indexOf(minimumLevel)

    if (userLevelIndex < requiredLevelIndex) {
        if (returnSession) redirect('/home')
        else return false
    }
    
    if (returnSession) return session
    else return true
}

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

    const responseData = await response.json()

    // Log user signup
    try {
        if (!responseData.user.id || !responseData.user.entity_id) return

        logUserSignUp(responseData.user.id, responseData.user.entity_id)
    } catch (error) {
        console.error("Failed to create audit log for user signup", error)
    }

    // Redirect to login page
    redirect('/login')
}

export async function logout() {
    const session = await sessionDetails()

    // Log user logout
    if (session?.user) {
        try {
            logUserLogout(session.user.id, session.user.entity_id)
        } catch (error) {
            console.error("Failed to create audit log for user logout", error)
        }
    }

    await auth.api.signOut({
        headers: await headers() 
    })

    redirect('/login')
}