import { db } from '../database'
import { StaffingSummary, NewStaffingSummary, Position, NewPosition } from '../../../types/staffing'

// CREATE (The most important part)
export async function createStaffingSubmission(
    entityId: string,
    papId: string, 
    summaryData: Omit<NewStaffingSummary, 'form_id'>,
    positions: Omit<NewPosition, 'staffing_summary_id'>[]
) {
    return await db.transaction().execute(async (trx) => {
        // 1. Create Base Form (The Envelope)
        // Satisfies the requirement for entity_id, pap_id, and type
        const form = await trx.insertInto('forms')
            .values({ 
                entity_id: entityId, 
                pap_id: papId, 
                type: 'staffing',
                codename: 'local', // Or add codename as a parameter to the function
                auth_status: 'pending'
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        // 2. Create Summary (The Document)
        const summary = await trx.insertInto('staffing_summary')
            .values({
                ...summaryData,
                form_id: form.id,
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        // 3. Create Position Rows (The Line Items)
        // We only attempt to insert if there are actually positions in the array
        if (positions.length > 0) {
            const positionRows = positions.map((p) => ({
                ...p,
                staffing_summary_id: summary.id
            }));

            await trx.insertInto('position')
                .values(positionRows)
                .execute();
        }

        return { formId: form.id, summaryId: summary.id };
    });
}

// READ
export async function getStaffingByFormId(formId: string) {
    return await db.selectFrom('staffing_summary')
        .innerJoin('position', 'position.staffing_summary_id', 'staffing_summary.id')
        .selectAll()
        .where('form_id', '=', formId)
        .execute();
}

export async function getAllStaffingSummaries() {
    return await db
        .selectFrom('staffing_summary')
        .innerJoin('forms', 'forms.id', 'staffing_summary.form_id')
        .select([
            'staffing_summary.id',
            'staffing_summary.fiscal_year',
            'staffing_summary.digital_signature',
            'staffing_summary.submission_date',
            'forms.auth_status', // Now you can show if it's Pending/Approved
            'forms.entity_id'
        ])
        .orderBy('staffing_summary.submission_date', 'desc')
        .execute()
}

export async function updateStaffingSubmission(
    summaryId: string, 
    payload: { 
        summary: any, 
        positions: any[] 
    }
) {
    return await db.transaction().execute(async (trx) => {
        // 1. Update the Staffing Summary (Header)
        await trx.updateTable('staffing_summary')
            .set({
                fiscal_year: payload.summary.fiscal_year,
                digital_signature: payload.summary.digital_signature,
                // Add other fields here as needed
            })
            .where('id', '=', summaryId)
            .execute();

        // 2. Delete ALL existing positions for this summary
        // This is cleaner than trying to "match" which rows changed
        await trx.deleteFrom('position')
            .where('staffing_summary_id', '=', summaryId)
            .execute();

        // 3. Re-insert the new/updated positions
        if (payload.positions.length > 0) {
            const positionRows = payload.positions.map(pos => ({
                ...pos,
                staffing_summary_id: summaryId
            }));

            await trx.insertInto('position')
                .values(positionRows)
                .execute();
        }

        return { success: true };
    });
}

/**
 * DELETE: Removes the entire submission by targeting the parent 'forms' entry.
 */
export async function deleteStaffingForm(summaryId: string) {
    const summary = await db
        .selectFrom('staffing_summary')
        .select('form_id')
        .where('id', '=', summaryId)
        .executeTakeFirst();

    if (summary) {
        await db.deleteFrom('forms')
            .where('id', '=', summary.form_id)
            .execute();
    }
}

export async function getStaffingWithPositions(summaryId: string) {
    // 1. Get the Summary Header (Join with forms to get auth_status)
    const summary = await db
        .selectFrom('staffing_summary')
        .innerJoin('forms', 'forms.id', 'staffing_summary.form_id')
        .select([
            'staffing_summary.id',
            'staffing_summary.form_id',
            'staffing_summary.fiscal_year',
            'staffing_summary.digital_signature',
            'staffing_summary.submission_date',
            'forms.auth_status',
            'forms.entity_id',
            'forms.pap_id'
        ])
        .where('staffing_summary.id', '=', summaryId)
        .executeTakeFirst();

    if (!summary) return null;

    // 2. Get all the Position rows for this specific summary
    const positions = await db
        .selectFrom('position')
        .selectAll()
        .where('staffing_summary_id', '=', summaryId)
        .execute();

    // 3. Combine them into one object for the frontend
    return {
        ...summary,
        positions: positions
    };
}