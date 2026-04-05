import { db } from '../database'
import { StaffingSummary, NewStaffingSummary, Position, NewPosition, StaffingSummaryWithPositions } from '../../../types/staffing'

// Helper function to inject tiers into position rows
async function injectTiers(
    trx: any, 
    positions: Omit<NewPosition, 'staffing_summary_id'>[]
): Promise<NewPosition[]> {
    // 1. Fetch PAPs with explicit typing
    const paps = await trx
        .selectFrom('pap')
        .select(['id', 'tier'])
        .execute();
    
    // 2. Map through positions with typed parameters
    return positions.map((pos) => {
        // Find the PAP in the database results
        const parentPap = paps.find((p: { id: string; tier: number }) => p.id === pos.pap_id);
        
        return {
            ...pos,
            tier: parentPap?.tier || 1, // Ensure tier is present for the DB
            staffing_summary_id: ""     // Placeholder that gets overwritten in the main function
        } as NewPosition;
    });
}

// CREATE
export async function createStaffingSubmission(
    entityId: string,
    summaryData: Omit<NewStaffingSummary, 'form_id'>,
    positions: Omit<NewPosition, 'staffing_summary_id'>[]
) {
    return await db.transaction().execute(async (trx) => {
        // 1. Create Base Form
        const form = await trx.insertInto('forms')
            .values({ 
                entity_id: entityId, 
                type: 'staffing',
                codename: 'Form 204',
                auth_status: 'pending'
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        // 2. Create Summary
        const summary = await trx.insertInto('staffing_summary')
            .values({
                form_id: form.id,
                fiscal_year: summaryData.fiscal_year,
                digital_signature: summaryData.digital_signature,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // 3. Create Position Rows with Tier Injection
        if (positions.length > 0) {
            // FIX: We fetch the tiers from the PAP table and attach them here
            const enrichedPositions = await injectTiers(trx, positions);
            
            const positionRows = enrichedPositions.map((p) => ({
                ...p,
                staffing_summary_id: summary.id
            }));

            await trx.insertInto('position')
                .values(positionRows)
                .execute();
        }

        // 4. Link PAPs to Form (for high-level tracking)
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
        await trx.updateTable('staffing_summary')
            .set({
                fiscal_year: payload.summary.fiscal_year,
                digital_signature: payload.summary.digital_signature,
            })
            .where('id', '=', summaryId)
            .execute();

        // 2. Delete existing positions
        await trx.deleteFrom('position')
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

            await trx.insertInto('position')
                .values(positionRows)
                .execute();
        }

        return { success: true };
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

export async function getStaffingById(id: string): Promise<StaffingSummaryWithPositions | undefined> {
    const summary = await db
        .selectFrom('staffing_summary')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst();

    if (!summary) return undefined;

    const positions = await db
        .selectFrom('position')
        .where('staffing_summary_id', '=', id)
        .selectAll()
        .execute();

    return {
        ...summary,
        positions
    };
}

/**
 * DELETE: Removes the entire submission by targeting the parent 'form' entry.
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
    // 1. Get the Summary Header (Join with form to get auth_status)
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