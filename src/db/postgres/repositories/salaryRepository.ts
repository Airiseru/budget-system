import { db } from "../database"
import {
    NewSalaryRate,
    NewCompensationRule,
    AllSalaryRates,
    CompensationRule
} from "../../../types/salaries"

export async function creaetNewSalarySchedule(
    circular_reference: string,
    effective_date: Date,
    rates: Omit<NewSalaryRate, 'id' | 'schedule_id'>[],
) {
    return await db.transaction().execute(async (trx) => {
        const schedule = await trx.insertInto('salary_schedules')
            .values({ circular_reference, effective_date })
            .returningAll()
            .executeTakeFirstOrThrow()
        
        if (rates.length > 0) {
            for (const rate of rates) {
                await trx.insertInto('salary_rates')
                    .values({ ...rate, schedule_id: schedule.id })
                    .returningAll()
                    .executeTakeFirstOrThrow()
            }
        }
        
        return { schedule, rates }
    })
}

export async function getLatestSalarySchedule(): Promise<AllSalaryRates | null> {
    const schedule = await db
        .selectFrom('salary_schedules')
        .selectAll()
        .orderBy('effective_date', 'desc')
        .limit(1)
        .executeTakeFirst()
    
    if (!schedule) return null

    const rates = await db
        .selectFrom('salary_rates')
        .where('schedule_id', '=', schedule.id)
        .select([
            'salary_rates.salary_grade as salary_grade',
            'salary_rates.step as step',
            'salary_rates.amount as amount',
        ])
        .execute()

    return { ...schedule, rates }
}

export async function getHighestSalaryGrade(): Promise<number> {
    const result = await db
        .selectFrom('salary_schedules')
        .selectAll()
        .orderBy('effective_date', 'desc')
        .limit(1)
        .innerJoin('salary_rates', 'salary_rates.schedule_id', 'salary_schedules.id')
        .select('salary_rates.salary_grade')
        .orderBy('salary_grade', 'desc')
        .limit(1)
        .executeTakeFirstOrThrow()

    return result.salary_grade
}

export async function getBaseRate(
    schedule_id: string,
    salary_grade: number,
    step: number
): Promise<{ amount: number }> {
    return await db
        .selectFrom('salary_rates')
        .where('schedule_id', '=', schedule_id)
        .where('salary_grade', '=', salary_grade)
        .where('step', '=', step)
        .select('amount')
        .executeTakeFirstOrThrow()
}

export async function createNewCompensationRule(compensation_rule: NewCompensationRule): Promise<NewCompensationRule> {
    return await db
        .insertInto('compensation_rules')
        .values(compensation_rule)
        .returningAll()
        .executeTakeFirstOrThrow()
}

export async function getUniqueCompensationRules(): Promise<CompensationRule[]> {
    return await db
        .selectFrom('compensation_rules')
        .distinctOn('name')
        .selectAll()
        .execute()
}

export async function getLatestCompensationRules(): Promise<CompensationRule[]> {
    const rules = await db
        .selectFrom('compensation_rules')
        // keep the first row it finds for each SG range
        .distinctOn(['name', 'min_salary_grade', 'max_salary_grade']) 
        .selectAll()
        .orderBy('name') 
        .orderBy('min_salary_grade')
        .orderBy('max_salary_grade')
        // get the latest rule based on effective date
        .orderBy('effective_date', 'desc') 
        .execute()

    return rules
}