import type { PackContentSummary } from '@keres/shared';

/** Formatting shared by the listing and the story page. */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unitIndex]}`;
}

/**
 * `language` comes from i18n, not from the browser: someone who chose to read the page in
 * Portuguese expects the date in Portuguese, even in a browser set to English.
 */
export function formatDate(isoDate: string, language?: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(language || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * `stories.genre` is free text in the app - whoever writes separates it however they like.
 * Splitting on comma, slash and semicolon covers what people actually type without inventing a new
 * rule.
 *
 * It is not translated: it is content written by the story's author.
 */
export function genreList(genre: string | null): string[] {
  if (!genre) return [];
  return genre
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * What a pack contains, as short phrases.
 *
 * Only the non-empty parts: a pack of nothing but tags should say "6 tags" and stop, not carry four
 * zeroes across the card. The stat notation rides along with the axes because a ladder of letters
 * and a ladder of numbers are different offers.
 */
export function packContentLines(
  summary: PackContentSummary,
  t: (key: string, options?: Record<string, unknown>) => string,
): string[] {
  const lines: string[] = [];
  if (summary.fieldCount > 0) {
    lines.push(t('pack.fieldCount', { count: summary.fieldCount }));
  }
  if (summary.statCount > 0) {
    lines.push(t('pack.statCount', { count: summary.statCount }));
  }
  if (summary.tagCount > 0) {
    lines.push(t('pack.tagCount', { count: summary.tagCount }));
  }
  if (summary.suggestionCount > 0) {
    lines.push(t('pack.suggestionCount', { count: summary.suggestionCount }));
  }
  if (summary.statSystem) {
    lines.push(t(`pack.notation.${summary.statNotation}`));
  }
  return lines;
}
