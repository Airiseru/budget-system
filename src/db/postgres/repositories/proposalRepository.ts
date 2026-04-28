import { db } from '../database'
import { 
    FullProjectProposal, 
    NewProjectProposal 
} from '../../../types/project_proposals'
import { sql } from 'kysely'
import { Transaction } from 'kysely';
import { Database } from '@/src/types';

/**
 * Helper to handle the "Cost Source" architecture.
 * This separates the Entity (Component/Location) from its specific Expense Classes (PS, MOOE, etc.)
 */
async function insertWithCostSource(
    trx: Transaction<Database>,
    tableName: keyof Database, 
    proposalId: string, 
    items: any[], 
    type: string
) {
    if (!items || items.length === 0) return;

    for (const item of items) {
        // 1. Create a tracking ID for the cost group
        const source = await trx.insertInto('cost_sources')
            .values({ type })
            .returning('id')
            .executeTakeFirstOrThrow();

        // 2. Separate costs array from the entity metadata (like component_name or location)
        const { costs, ...entityData } = item;

        // 3. Insert the entity (e.g., the Component Row)
        await trx.insertInto(tableName as any)
            .values({ 
                ...entityData, 
                proposal_id: proposalId, 
                cost_source_id: source.id 
            })
            .execute();

        // 4. Insert the nested expense classes (PS, MOOE, CO, FE)
        if (costs && costs.length > 0) {
            await trx.insertInto('cost_by_expense_class')
                .values(costs.map((c: any) => ({ 
                    amount: c.amount,
                    expense_class: c.expense_class,
                    currency: c.currency || 'PHP',
                    cost_source_id: source.id 
                })))
                .execute();
        }
    }
}

export async function createProjectProposal(
    entityId: string,
    proposalData: any, 
    payload: any,      
    authStatus: string
) {
    return await db.transaction().execute(async (trx) => {
        // 1. Insert into Master Forms table
        const form = await trx.insertInto('forms')
            .values({ 
                entity_id: entityId, 
                type: proposalData.type === '202' ? ( proposalData.is_new ? 'BP Form 202 (New)' : 'BP Form 202 (Expanded)') : ( proposalData.is_new ? 'BP Form 203 (New)' : 'BP Form 203 (Expanded)'),
                codename: `BP Form ${proposalData.type}`,
                auth_status: authStatus
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        // 2. Insert into Project Proposals 
        const project = await trx.insertInto('project_proposals')
            .values({ 
                id: form.id,
                title: proposalData.title,
                proposal_year: proposalData.proposal_year,
                priority_rank: proposalData.priority_rank,
                is_new: proposalData.is_new ?? true, 
                is_infrastructure: proposalData.is_infrastructure ?? false,
                for_ict: proposalData.for_ict ?? false,
                myca_issuance: proposalData.myca_issuance,
                total_proposal_currency: proposalData.total_proposal_currency || 'PHP',
                total_proposal_cost: proposalData.total_proposal_cost || 0,
                type: proposalData.type,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        // 3. Create the PAP record (Mapped to your specific schema)
        const newPap = await trx.insertInto('paps')
            .values({
                entity_id: entityId,
                title: proposalData.title,
                // These columns are NOT NULL in your schema, 
                // so ensure they exist in proposalData or use defaults:
                org_outcome_id: proposalData.org_outcome_id || 'O-1', 
                description: proposalData.description || 'No description provided.',
                purpose: proposalData.purpose || 'No purpose provided.',
                beneficiaries: proposalData.beneficiaries || 'General Public',
                
                project_type: proposalData.is_infrastructure ? 'infrastructure' : 'non-infrastructure',
                project_status: 'proposed',
                auth_status: authStatus,
                category: proposalData.type === '202' ? 'local' : 'foreign',
                tier: 1, // Defaulting to Tier 1 for new proposals
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        // 4. Link Form and PAP in the junction table
        await trx.insertInto('form_paps')
            .values({
                form_id: form.id,
                pap_id: newPap.id
            })
            .execute();

        // 5. Insert PAP Prerequisites
        if (payload.pap_prerequisites?.length) {
            await trx.insertInto('pap_prerequisites')
                .values(payload.pap_prerequisites.map((p: any) => ({
                    ...p,
                    proposal_id: form.id 
                })))
                .execute();
        }

        // 6. Insert Costs & Other arrays (Simplified for brevity)
        await insertWithCostSource(trx, 'cost_by_components', form.id, payload.cost_by_components, 'component');

        if (proposalData.type === '202') {
            await insertWithCostSource(trx, 'local_financial_attributions', form.id, payload.local_financial_attributions, 'fin_attr');
            await insertWithCostSource(trx, 'local_infrastructure_requirements', form.id, payload.local_infrastructure_requirements, 'infra');
            await insertWithCostSource(trx, 'local_locations', form.id, payload.local_locations, 'location');
            
            if (payload.local_physical_targets?.length) {
                await trx.insertInto('local_physical_targets')
                    .values(payload.local_physical_targets.map((p: any) => ({ ...p, proposal_id: form.id })))
                    .execute();
            }
        } else {
             await insertWithCostSource(trx, 'foreign_financial_targets', form.id, payload.foreign_financial_targets, 'for_fin');
             // ... and other foreign tables
        }

        return { formId: form.id, papId: newPap.id, createdAt: project.created_at };
    });
}

export async function getProjectProposalById(id: string): Promise<FullProjectProposal | null> {
    const project = await db
        .selectFrom('project_proposals')
        .innerJoin('forms', 'forms.id', 'project_proposals.id')
        .selectAll('project_proposals')
        .select('forms.auth_status as auth_status')
        .where('project_proposals.id', '=', id)
        .executeTakeFirst();

    if (!project) return null;

    const fetchWithCosts = async (tableName: any) => {
        const items = await db.selectFrom(tableName).where('proposal_id', '=', id).selectAll().execute();
        return await Promise.all(items.map(async (item: any) => {
            const costs = await db.selectFrom('cost_by_expense_class')
                .where('cost_source_id', '=', item.cost_source_id)
                .selectAll().execute();
            return { ...item, costs };
        }));
    };

    return {
        ...project,
        pap_prerequisites: await db.selectFrom('pap_prerequisites').where('proposal_id', '=', id).selectAll().execute(),
        cost_by_components: await fetchWithCosts('cost_by_components'),
        local_financial_attributions: await fetchWithCosts('local_financial_attributions'),
        local_physical_targets: await db.selectFrom('local_physical_targets').where('proposal_id', '=', id).selectAll().execute(),
        local_infrastructure_requirements: await fetchWithCosts('local_infrastructure_requirements'),
        local_locations: await fetchWithCosts('local_locations'),
        foreign_financial_targets: await fetchWithCosts('foreign_financial_targets'),
        foreign_physical_targets: await db.selectFrom('foreign_physical_targets').where('proposal_id', '=', id).selectAll().execute(),
    } as any;
}

export async function getAllProposalSummaries(
    userId: string,
    entityType: string,
    entityId: string) {
    let query = db
        .selectFrom('project_proposals as pp')
        .innerJoin('forms as f', 'f.id', 'pp.id')
        .select([
            'pp.id',
            'f.entity_id',
            'f.codename', // e.g., "BP Form 202"
            'pp.proposal_year',
            'pp.priority_rank',
            'pp.type',
            'pp.total_proposal_cost',
            'pp.total_proposal_currency',
            'f.auth_status',
            'pp.submission_date',
            'pp.is_infrastructure'
        ]);

    // If an entityId is provided, filter the results (Security Gate)
    if (entityId) {
        query = query.where('f.entity_id', '=', entityId);
    }

    if (entityType !== 'admin') {
        // Use the explicit table name in the where clause
        query = query.where('f.entity_id', '=', entityId);
    }

    return await query
        .orderBy('pp.proposal_year', 'desc')
        .orderBy('pp.priority_rank', 'asc')
        .execute();
}

export async function updateProjectProposal(proposalId: string, payload: any) {
    return await db.transaction().execute(async (trx) => {
        const { payload: p, auth_status } = payload;

        // 1. Update form status
        if (auth_status) {
            await trx.updateTable('forms').set({ auth_status }).where('id', '=', proposalId).execute();
        }

        // 2. Wipe existing related data (Cascading Cleanup)
        // We delete from cost_sources which cascades (if set in DB) or we manually delete relations
        await sql`
            DELETE FROM cost_sources 
            WHERE id IN (
                SELECT cost_source_id FROM cost_by_components WHERE proposal_id = ${proposalId}
                UNION SELECT cost_source_id FROM local_financial_attributions WHERE proposal_id = ${proposalId}
                UNION SELECT cost_source_id FROM local_infrastructure_requirements WHERE proposal_id = ${proposalId}
                UNION SELECT cost_source_id FROM local_locations WHERE proposal_id = ${proposalId}
                UNION SELECT cost_source_id FROM foreign_financial_targets WHERE proposal_id = ${proposalId}
            )
        `.execute(trx);

        const nonCostTables = ['pap_prerequisites', 'local_physical_targets', 'foreign_physical_targets'] as const;
        for (const table of nonCostTables) {
            await trx.deleteFrom(table).where('proposal_id', '=', proposalId).execute();
        }

        // 3. Update main proposal row
        await trx.updateTable('project_proposals')
            .set({ 
                proposal_year: p.proposal_year,
                priority_rank: p.priority_rank,
                is_new: p.is_new,
                is_infrastructure: p.is_infrastructure,
                for_ict: p.for_ict,
                total_proposal_cost: p.total_proposal_cost,
                updated_at: sql`now()` 
            })
            .where('id', '=', proposalId).execute();

        // 4. Re-insert arrays
        if (p.pap_prerequisites?.length) {
            await trx.insertInto('pap_prerequisites').values(p.pap_prerequisites.map((i:any) => ({...i, proposal_id: proposalId}))).execute();
        }
        
        await insertWithCostSource(trx, 'cost_by_components', proposalId, p.cost_by_components, 'component');

        if (p.type === '202') {
            await insertWithCostSource(trx, 'local_financial_attributions', proposalId, p.local_financial_attributions, 'fin');
            await insertWithCostSource(trx, 'local_infrastructure_requirements', proposalId, p.local_infrastructure_requirements, 'infra');
            await insertWithCostSource(trx, 'local_locations', proposalId, p.local_locations, 'loc');
            
            if (p.local_physical_targets?.length) {
                await trx.insertInto('local_physical_targets').values(p.local_physical_targets.map((i:any) => ({...i, proposal_id: proposalId}))).execute();
            }
        } else {
            await insertWithCostSource(trx, 'foreign_financial_targets', proposalId, p.foreign_financial_targets, 'for_fin');
            if (p.foreign_physical_targets?.length) {
                await trx.insertInto('foreign_physical_targets').values(p.foreign_physical_targets.map((i:any) => ({...i, proposal_id: proposalId}))).execute();
            }
        }

        return { success: true };
    });
}

export async function deleteProjectProposal(id: string) {
    // Relying on ON DELETE CASCADE from the forms table
    await db.deleteFrom('forms').where('id', '=', id).execute();
}