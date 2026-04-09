import { db } from '../database'
import { StaffingSummary, NewStaffingSummary, Position, NewPosition, StaffingSummaryWithPositions, NewCompensation } from '../../../types/staffing'

import { jsonArrayFrom } from 'kysely/helpers/postgres'

// Helper function to inject tiers while preserving extra data (like compensations)
async function injectTiers<T extends { pap_id: string }>(
    trx: any, 
    positions: T[]
): Promise<(T & { tier: number; staffing_summary_id: string })[]> {
    // 1. Fetch PAPs
    const paps = await trx
        .selectFrom('paps')
        .select(['id', 'tier'])
        .execute();
    
    // 2. Map through positions
    return positions.map((pos) => {
        const parentPap = paps.find((p: { id: string; tier: number }) => p.id === pos.pap_id);
        
        return {
            ...pos,
            tier: parentPap?.tier || 1,
            staffing_summary_id: "" // Placeholder
        };
    });
}

interface PositionInput extends Omit<NewPosition, 'staffing_summary_id'> {
    compensations?: {
        name: string;
        amount: number;
    }[];
}

// CREATE
export async function createStaffingSubmission(
    entityId: string,
    summaryData: Omit<NewStaffingSummary, 'id' | 'submission_date' | 'created_at' | 'updated_at'>,
    positions: Omit<NewPosition, 'staffing_summary_id'>[]
) {
    return await db.transaction().execute(async (trx) => {
        // 1. Create Base Form
        const form = await trx.insertInto('forms')
            .values({ 
                entity_id: entityId, 
                type: 'BP',
                codename: 'bp204',
                auth_status: 'pending_personnel'
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        // 2. Create Summary
        const summary = await trx.insertInto('staffing_summaries')
            .values({
                id: form.id,
                fiscal_year: summaryData.fiscal_year,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
        
        // 3. Positions
        if (positions.length > 0) {
            const enrichedPositions = await injectTiers(trx, positions);
            
            for (const pos of enrichedPositions) {
                const currentPos = pos as PositionInput;
                const { compensations, ...positionData } = currentPos;

                const insertedPosition = await trx.insertInto('positions')
                    .values({
                        ...positionData,
                        staffing_summary_id: summary.id
                    })
                    .returning('id')
                    .executeTakeFirstOrThrow();

                if (compensations && compensations.length > 0) {
                    await trx.insertInto('compensations')
                        .values(compensations.map(comp => ({
                            name: comp.name,    
                            amount: comp.amount, 
                            staff_id: insertedPosition.id 
                        })))
                        .execute();
                }
            }
        }

        // 4. Link PAPs to Form
        const uniquePaps = [...new Set(positions.map(p => p.pap_id))].filter(Boolean);
        if (uniquePaps.length > 0) {
            await trx.insertInto('form_paps')
                .values(uniquePaps.map(id => ({
                    form_id: form.id, 
                    pap_id: id as string
                })))
                .execute();
        }

        return { formId: form.id, summaryId: summary.id };
    });
}

// UPDATE
export async function updateStaffingSubmission(
    summaryId: string, 
    payload: { 
        summary: any, 
        positions: any[] 
    }
) {
    return await db.transaction().execute(async (trx) => {
        // 1. Update Header
        await trx.updateTable('staffing_summaries')
            .set({
                fiscal_year: payload.summary.fiscal_year
            })
            .where('id', '=', summaryId)
            .execute();

        // 2. Delete existing positions
        await trx.deleteFrom('positions')
            .where('staffing_summary_id', '=', summaryId)
            .execute();

        // 3. Re-insert with Tier Injection
        if (payload.positions.length > 0) {
            // FIX: Again, lookup tiers to ensure DB integrity
            const enrichedPositions = await injectTiers(trx, payload.positions);
            
            const positionRows = enrichedPositions.map(pos => ({
                ...pos,
                staffing_summary_id: summaryId
            }));

            await trx.insertInto('positions')
                .values(positionRows)
                .execute();
        }

        return { success: true };
    });
}

// READ
export async function getStaffingByFormId(formId: string) {
    return await db.selectFrom('staffing_summaries')
        .innerJoin('positions', 'positions.staffing_summary_id', 'staffing_summaries.id')
        .selectAll()
        .where('staffing_summaries.id', '=', formId)
        .execute();
}

export async function getAllStaffingSummaries(
    entityId: string,
    entityType: string,
    userEntityId: string
) {
    let query = db
        .selectFrom('staffing_summaries')
        .innerJoin('forms', 'forms.id', 'staffing_summaries.id')
        .innerJoin('entities', 'entities.id', 'forms.entity_id')
        .select([
            'staffing_summaries.id',
            'staffing_summaries.fiscal_year',
            'staffing_summaries.submission_date',
            'forms.auth_status',
            'forms.entity_id',
            'entities.type as entity_type'
        ])
        .orderBy('staffing_summaries.submission_date', 'desc')

    // Return all if national
    if (entityType === 'national') {
        return await query.execute()
    }

    // Department can see forms from their department, agency, or operating unit
    if (entityType === 'department') {
        return await query
            .leftJoin('agencies', 'agencies.id', 'forms.entity_id')
            .leftJoin('operating_units', 'operating_units.id', 'forms.entity_id')
            .where(({ eb, or }) => or([
                eb('forms.entity_id', '=', userEntityId),
                eb('agencies.department_id', '=', userEntityId),
                eb('operating_units.agency_id', 'in',
                    db.selectFrom('agencies')
                        .where('department_id', '=', userEntityId)
                        .select('id')
                ),
            ]))
            .execute()
    }

    // Agency can see forms from their agency or operating unit
    if (entityType === 'agency') {
        return await query
            .leftJoin('operating_units', 'operating_units.id', 'forms.entity_id')
            .where(({ eb, or }) => or([
                eb('forms.entity_id', '=', userEntityId),
                eb('operating_units.agency_id', '=', userEntityId),
            ]))
            .execute()
    }

    // Operating Unit can only see their own
    return await query.
        where('forms.entity_id', '=', userEntityId)
        .execute()
}

export async function getStaffingById(id: string): Promise<StaffingSummaryWithPositions | undefined> {
    const summary = await db
        .selectFrom('staffing_summaries')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();

    if (!summary) return undefined;

    const positions = await db
        .selectFrom('positions')
        .where('staffing_summary_id', '=', id)
        .selectAll()
        .execute();

    return {
        ...summary,
        positions
    };
}

export async function getStaffingWithFormById(id: string) {
    return await db
        .selectFrom('staffing_summaries')
        .innerJoin('forms', 'forms.id', 'staffing_summaries.id')
        .where('staffing_summaries.id', '=', id)
        .select([
            'staffing_summaries.id as id',
            'staffing_summaries.created_at as created_at',
            'staffing_summaries.updated_at as updated_at',
            'staffing_summaries.fiscal_year as fiscal_year',
            'staffing_summaries.submission_date as submission_date',
            'forms.entity_id as entity_id',
            'forms.type as type',
            'forms.auth_status as auth_status'
        ])
        .executeTakeFirst();
}

export async function getStaffingDetails(formId: string) {
    return await db.selectFrom('positions')
        .where('staffing_summary_id', '=', formId)
        .select((eb) => [
            'id',
            'position_title',
            'salary_grade',
            'num_positions',
            'total_salary',
            jsonArrayFrom(
                eb.selectFrom('compensations')
                    .select(['name', 'amount'])
                    .whereRef('compensations.staff_id', '=', 'positions.id')
            ).as('compensations')
        ])
        .execute();
}

/**
 * DELETE: Removes the entire submission by targeting the parent 'form' entry.
 */
export async function deleteStaffingForm(summaryId: string) {
    await db.deleteFrom('forms')
        .where('id', '=', summaryId)
        .execute();
}

export async function getStaffingWithPositions(summaryId: string) {
    // 1. Get the Summary Header (Join with form to get auth_status)
    const summary = await db
        .selectFrom('staffing_summaries')
        .innerJoin('forms', 'forms.id', 'staffing_summaries.id')
        .select([
            'staffing_summaries.id',
            'staffing_summaries.fiscal_year',
            'staffing_summaries.submission_date',
            'forms.auth_status',
            'forms.entity_id',
        ])
        .where('staffing_summaries.id', '=', summaryId)
        .executeTakeFirst();

    if (!summary) return null;

    // 2. Get all the Position rows for this specific summary
    const positions = await db
        .selectFrom('positions')
        .selectAll()
        .where('staffing_summary_id', '=', summaryId)
        .execute();

    // 3. Combine them into one object for the frontend
    return {
        ...summary,
        positions: positions
    };
}

