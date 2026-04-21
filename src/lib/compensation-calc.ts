import { CompensationRule } from '@/src/types/salaries'

export function computeCompensationAmount(
    rule: CompensationRule,
    monthlyBaseSalary: number,
    numPositions: number,
    monthsEmployed: number,
): number {
    const ruleValue = Number(rule.rule_value)
    const calcType = rule.calculation_type
    const frequency = rule.frequency

    if (calcType === 'fixed' && frequency === 'annual') {
        // fixed annual = rule_value * num_positions
        return ruleValue * numPositions
    }

    if (calcType === 'fixed' && frequency === 'monthly') {
        // fixed monthly = rule_value * months_employed * num_positions
        return ruleValue * monthsEmployed * numPositions
    }

    if (calcType === 'percentage' && frequency === 'monthly') {
        // percentage monthly = rule_value * monthly_base_salary * months_employed * num_positions
        return (ruleValue / 100) * monthlyBaseSalary * monthsEmployed * numPositions
    }

    if (calcType === 'value_multiplier' && frequency === 'monthly') {
        // value multiplier monthly = rule_value * months_employed * num_positions
        return ruleValue * monthsEmployed * numPositions
    }

    if (calcType === 'salary_multiplier' && frequency === 'annual') {
        // salary multiplier annual = rule_value * monthly_base_salary * num_positions
        return ruleValue * monthlyBaseSalary * numPositions
    }

    return 0
}

// get all applicable rules for a salary grade, excluding RATA (handled separately)
export function getApplicableRules(
    rules: CompensationRule[],
    salaryGrade: number,
): CompensationRule[] {
    return rules.filter(r =>
        r.name !== 'RATA' &&
        Number(r.min_salary_grade) <= salaryGrade &&
        Number(r.max_salary_grade) >= salaryGrade
    )
}

// get all RATA options for a salary grade
export function getRataOptions(
    rules: CompensationRule[],
    salaryGrade: number,
): CompensationRule[] {
    return rules.filter(r =>
        r.name === 'RATA' &&
        Number(r.min_salary_grade) <= salaryGrade &&
        Number(r.max_salary_grade) >= salaryGrade
    )
}

// build the full auto-computed compensation list for a position
// returns compensations with total computed amounts
export function buildAutoCompensations(
    rules: CompensationRule[],
    salaryGrade: number,
    monthlyBaseSalary: number,
    numPositions: number,
    monthsEmployed: number,
    selectedRataRuleId: string | null,
): { compensation_rule_id: string; name: string; amount: number }[] {
    const result: { compensation_rule_id: string; name: string; amount: number }[] = []

    // auto rules (all except RATA)
    const applicable = getApplicableRules(rules, salaryGrade)
    for (const rule of applicable) {
        const amount = computeCompensationAmount(rule, monthlyBaseSalary, numPositions, monthsEmployed)
        result.push({ compensation_rule_id: rule.id, name: rule.name, amount })
    }

    // RATA — only if user selected one
    if (selectedRataRuleId) {
        const rataRule = rules.find(r => r.id === selectedRataRuleId)
        if (rataRule) {
            const amount = computeCompensationAmount(rataRule, monthlyBaseSalary, numPositions, monthsEmployed)
            result.push({ compensation_rule_id: rataRule.id, name: 'RATA', amount })
        }
    }

    return result
}