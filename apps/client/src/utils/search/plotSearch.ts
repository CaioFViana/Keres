import type { AdvancedSearchCriteria } from './advancedSearchCriteria';

interface SearchablePlot {
  name: string;
  details?: string | null;
}

/**
 * Whether a plot belongs in the list for the typed words and the field filters. Plots are read whole
 * into the screen, so the search happens here instead of in a query: the words look in the name and the
 * details, each field filter in its own field, all as "contains" regardless of case.
 */
export function plotMatches(
  plot: SearchablePlot,
  searchTerm: string,
  criteria: AdvancedSearchCriteria,
): boolean {
  const contains = (text: string | null | undefined, wanted: unknown) =>
    (text ?? '').toLowerCase().includes(String(wanted).trim().toLowerCase());

  const term = searchTerm.trim();
  if (term && !contains(`${plot.name} ${plot.details ?? ''}`, term)) return false;

  if (criteria.name !== undefined && criteria.name !== '' && !contains(plot.name, criteria.name)) {
    return false;
  }
  if (
    criteria.details !== undefined &&
    criteria.details !== '' &&
    !contains(plot.details, criteria.details)
  ) {
    return false;
  }
  return true;
}
