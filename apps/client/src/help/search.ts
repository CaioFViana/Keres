import type { HelpPage } from './types';

interface IndexedHelpPage {
  page: HelpPage;
  order: number;
  title: string;
  keywords: string;
  summary: string;
  body: string;
  flattenedPage: string;
}

export interface HelpSearchIndex {
  entries: IndexedHelpPage[];
}
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

/** It prepares the content once so the search does not re-flatten the 53 pages on every keystroke. */
export function createHelpSearchIndex(pages: HelpPage[]): HelpSearchIndex {
  return {
    entries: pages.map((page, order) => {
      const flattenedPage = flattenHelpPage(page);
      return {
        page,
        order,
        title: normalize(page.title),
        keywords: normalize(page.keywords.join(' ')),
        summary: normalize(page.summary),
        body: normalize(flattenedPage),
        flattenedPage,
      };
    }),
  };
}

/** It searches an already-prepared index; the caller has to keep it while the language does not change. */
export function searchHelp(index: HelpSearchIndex, query: string) {
  const needle = normalize(query.trim());
  if (!needle) return [];
  return index.entries
    .map(({ page, order, title, keywords, summary, body, flattenedPage }) => {
      const rank = title.includes(needle)
        ? 0
        : keywords.includes(needle)
          ? 1
          : summary.includes(needle)
            ? 2
            : body.includes(needle)
              ? 3
              : -1;
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
