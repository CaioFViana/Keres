const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago something was edited, said the way the person's language says it ("2 hours ago"). Past a
 * month a date is clearer than a count, and an engine without relative-time formatting gets the date too.
 */
export function formatEditedAgo(editedAt: Date, now: Date, language: string): string {
  const elapsed = Math.max(0, now.getTime() - editedAt.getTime());
  const plain = () => editedAt.toLocaleDateString(language);
  if (elapsed >= 30 * DAY) return plain();
  try {
    const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    if (elapsed < MINUTE) return formatter.format(0, 'minute');
    if (elapsed < HOUR) return formatter.format(-Math.floor(elapsed / MINUTE), 'minute');
    if (elapsed < DAY) return formatter.format(-Math.floor(elapsed / HOUR), 'hour');
    return formatter.format(-Math.floor(elapsed / DAY), 'day');
  } catch {
    return plain();
  }
}
