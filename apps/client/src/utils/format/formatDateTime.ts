/**
 * A moment the way the person reads it unmistakably: the month by name and the hour (`Oct 10, 2026, 8:07 PM`),
 * not `10/10/2026, 20:07:25`, whose day and month some readers swap.
 */
export function formatDateTime(value: string | number | Date, language?: string): string {
  return new Date(value).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
}
