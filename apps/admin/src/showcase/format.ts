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

/**
 * `language` vem do i18n, e não do navegador: quem escolheu ler a página em português espera a
 * data em português, mesmo num navegador configurado em inglês.
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
 * `stories.genre` é texto livre no app - quem escreve separa como quer. Dividir por vírgula,
 * barra e ponto-e-vírgula cobre o que as pessoas de fato digitam sem inventar uma regra nova.
 *
 * Não é traduzido: é conteúdo de quem escreveu a história.
 */
export function genreList(genre: string | null): string[] {
  if (!genre) return [];
  return genre
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
