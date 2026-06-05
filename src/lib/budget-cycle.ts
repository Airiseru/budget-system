import { createBudgetSettingsRepository } from "@/src/db/factory";

const BudgetSettingsRepository = createBudgetSettingsRepository(
    process.env.DATABASE_TYPE || "postgres",
);

export const BUDGET_PREP_CLOSED_MESSAGE =
    "The budget preparation phase is not open for entity submissions. Please wait for further announcements from DBM.";

export async function getActiveBudgetPrepCycle() {
    return await BudgetSettingsRepository.getActiveBudgetCycle();
}

export async function isBudgetPrepActiveForYear(fiscalYear: number) {
    const activeCycle = await getActiveBudgetPrepCycle();
    return (
        activeCycle?.fiscal_year === fiscalYear &&
        activeCycle.current_phase === "preparation"
    );
}

export async function isDbmFormActionPhaseForYear(fiscalYear: number) {
    const activeCycle = await getActiveBudgetPrepCycle();
    return (
        activeCycle?.fiscal_year === fiscalYear &&
        (activeCycle.current_phase === "preparation" ||
            activeCycle.current_phase === "dbm_review")
    );
}

export function getBudgetPrepClosedError(fiscalYear: number) {
    return `Budget preparation is not active for fiscal year ${fiscalYear}. ${BUDGET_PREP_CLOSED_MESSAGE}`;
}
