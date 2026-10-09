import type { AdvancedSearchCriteria } from '../types/entityFilters';

export type { AdvancedSearchCriteria };

/** A criterion counts only when it narrows something: `false` does (a "No" answer), an empty text does not. */
export function isActiveCriterion(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'number' && Number.isNaN(value)) return false;
  return true;
}

/** The criteria that actually narrow the list, in the order they were set. */
export function activeCriteria(
  criteria: AdvancedSearchCriteria | undefined,
): AdvancedSearchCriteria {
  const result: AdvancedSearchCriteria = {};
  for (const [key, value] of Object.entries(criteria ?? {})) {
    if (isActiveCriterion(value)) result[key] = value;
  }
  return result;
}

export function countActiveCriteria(criteria: AdvancedSearchCriteria | undefined): number {
  return Object.keys(activeCriteria(criteria)).length;
}

/** The same criteria without one field; the others keep their values. */
export function withoutCriterion(
  criteria: AdvancedSearchCriteria | undefined,
  key: string,
): AdvancedSearchCriteria {
  const { [key]: _removed, ...rest } = activeCriteria(criteria);
  return rest;
}
