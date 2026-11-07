// Initial daily execution-gas allowance for newly registered merchants (0.01 WBT).
export const DEFAULT_REGISTRATION_DAILY_GAS_BUDGET = '10000000000000000';

export const isGasBudget = (value) =>
  value === 'unlimited' || /^[0-9]+$/.test(value);
export const exceedsGasBudget = (cost, budget) =>
  budget !== null && budget !== 'unlimited' && cost > BigInt(budget);
