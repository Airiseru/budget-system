'use server'

import { createSalaryRepository } from "../db/factory"
import { sessionDetails } from "./auth"
import { SalaryScheduleSchema, SalaryScheduleState } from "../lib/validations/salary.schema"
import { CompensationRuleSchema, CompensationRuleState } from "../lib/validations/compensation.schema"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from 'zod'

const SalaryRepository = createSalaryRepository(process.env.DATABASE_TYPE || 'postgres')

export async function createSalaryScheduleAction(
    state: SalaryScheduleState,
    formData: FormData
): Promise<SalaryScheduleState> {
    const session = await sessionDetails()
    if (!session) redirect('/login')
    
    if (session.user.role !== 'dbm') {
        redirect('/home')
    }
 
    const circular_reference = formData.get('circular_reference') as string
    const effective_date = formData.get('effective_date') as string
 
    // parse rates from JSON
    let rates = []

    try {
        rates = JSON.parse(formData.get('rates') as string ?? '[]')
    } catch {
        return { formErrors: ['Invalid rates data'], values: { circular_reference, effective_date } }
    }
 
    const parsed = SalaryScheduleSchema.safeParse({ circular_reference, effective_date, rates })
 
    if (!parsed.success) {
        return {
            ...z.flattenError(parsed.error),
            values: { circular_reference, effective_date },
        }
    }
 
    try {
        await SalaryRepository.creaetNewSalarySchedule(
            parsed.data.circular_reference,
            parsed.data.effective_date,
            parsed.data.rates,
        )
    } catch (err: any) {
        return { formErrors: [err?.message ?? 'Failed to create salary schedule'] }
    }
 
    revalidatePath('/dbm/salary')
    return { success: true }
}

export async function createCompensationRuleAction(
    state: CompensationRuleState,
    formData: FormData
): Promise<CompensationRuleState> {
    const session = await sessionDetails()
    if (!session) redirect('/login')

    if (session.user.role !== 'dbm') {
        redirect('/home')
    }
 
    const raw = Object.fromEntries(formData.entries()) as Record<string, string>
    const parsed = CompensationRuleSchema.safeParse(raw)
 
    if (!parsed.success) {
        return { ...z.flattenError(parsed.error), values: raw }
    }
 
    try {
        await SalaryRepository.createNewCompensationRule(parsed.data)
    } catch (err: any) {
        return { formErrors: [err?.message ?? 'Failed to create compensation rule'], values: raw }
    }
 
    revalidatePath('/dbm/salary')
    return { success: true }
}