/** Formatações que a listagem e a página de história compartilham. */

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

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * `stories.genre` é texto livre no app - quem escreve separa como quer. Dividir por vírgula,
 * barra e ponto-e-vírgula cobre o que as pessoas de fato digitam sem inventar uma regra nova.
 */
export function genreList(genre: string | null): string[] {
  if (!genre) return [];
  return genre
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
