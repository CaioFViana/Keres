import { HelpPage } from './types';
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function findNormalizedMatch(value: string, needle: string): number {
  let normalizedValue = '';
  const originalIndexes: number[] = [];

  let index = 0;
  while (index < value.length) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    const normalizedCharacter = normalize(character);
    normalizedValue += normalizedCharacter;
    originalIndexes.push(...Array.from(normalizedCharacter, () => index));
    index += character.length;
  }

  const normalizedIndex = normalizedValue.indexOf(needle);
  return normalizedIndex < 0 ? -1 : (originalIndexes[normalizedIndex] ?? -1);
}

export function flattenHelpPage(page: HelpPage): string {
  const blockText = page.blocks.flatMap((block) => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'callout':
        return [block.text];
      case 'list':
      case 'steps':
        return block.items;
      case 'path':
        return block.segments;
      case 'example':
        return [block.title ?? '', block.text];
      case 'fields':
        return block.rows.flatMap((row) => [row.label, row.whatToWrite, row.note ?? '']);
      case 'table':
        return [block.headers.join(' '), ...block.rows.map((row) => row.join(' '))];
      case 'faq':
        return block.items.flatMap((item) => [item.question, item.answer]);
      case 'seeAlso':
        return [];
    }
  });
  return [page.title, page.summary, ...page.keywords, ...blockText].join(' ');
}
export function searchHelp(pages: HelpPage[], query: string) {
  const needle = normalize(query.trim());
  if (!needle) return [];
  return pages
    .map((page, order) => {
      const title = normalize(page.title),
        keywords = normalize(page.keywords.join(' ')),
        summary = normalize(page.summary);
      const body = normalize(flattenHelpPage(page));
      const rank = title.includes(needle)
        ? 0
        : keywords.includes(needle)
          ? 1
          : summary.includes(needle)
            ? 2
            : body.includes(needle)
              ? 3
              : -1;
      const flattenedPage = flattenHelpPage(page);
      const bodyMatch = findNormalizedMatch(flattenedPage, needle);
      const excerptStart = bodyMatch > 56 ? bodyMatch - 56 : 0;
      const excerpt =
        bodyMatch >= 0
          ? flattenedPage.slice(excerptStart, bodyMatch + query.trim().length + 96).trim()
          : page.summary;
      return { page, order, rank, excerpt };
    })
    .filter((result) => result.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.order - b.order);
}
