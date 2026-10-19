/**
 * The name of a kind of story data in the administrator's language. The server names them in English, as
 * the code does (`AttributeValue`); a kind this panel has no name for is shown as it came.
 */
export function entityTypeLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  entityType: string,
): string {
  return t(`entityTypes.${entityType}`, { defaultValue: entityType });
}
