/**
 * The rows whose name or description contains the search text, ignoring case and surrounding
 * spaces. A blank search returns every row.
 */
export function filterByNameAndDescription<T extends { name: string; description?: string | null }>(
  items: T[],
  searchQuery: string,
): T[] {
  const query = searchQuery.trim().toLocaleLowerCase();
  if (!query) return items;
  return items.filter(({ name, description }) =>
    `${name} ${description ?? ''}`.toLocaleLowerCase().includes(query),
  );
}
