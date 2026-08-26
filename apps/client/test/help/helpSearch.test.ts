import { getHelpPages } from '../../src/help/repository';
import { createHelpSearchIndex, searchHelp } from '../../src/help/search';
import type { HelpPage } from '../../src/help/types';

describe('help search', () => {
  const pages = getHelpPages('pt');
  const index = createHelpSearchIndex(pages);
  it('matches accents and case-insensitively', () =>
    expect(searchHelp(index, 'HISTORIA').some((result) => result.page.id === 'what-is-keres')).toBe(
      true,
    ));
  it('matches keywords', () =>
    expect(searchHelp(index, 'inventario').some((result) => result.page.id === 'story-state')).toBe(
      true,
    ));
  it('prioritizes titles', () =>
    expect(searchHelp(index, 'personagens')[0]?.page.id).toBe('characters'));
  it('finds text in renderable blocks and keeps an accented excerpt', () => {
    const page: HelpPage = {
      id: 'what-is-keres',
      title: 'Página de teste',
      summary: 'Resumo',
      keywords: [],
      blocks: [{ type: 'paragraph', text: 'A história começa numa estação vazia.' }],
    };

    const [result] = searchHelp(createHelpSearchIndex([page]), 'historia');
    expect(result?.page.id).toBe('what-is-keres');
    expect(result?.excerpt).toContain('história');
  });
  it('uses the catalog order to break ties at the same rank', () => {
    const pagesWithTie: HelpPage[] = [
      {
        id: 'what-is-keres',
        title: 'Primeira página',
        summary: 'Inclui o termo procurado.',
        keywords: [],
        blocks: [],
      },
      {
        id: 'first-story',
        title: 'Segunda página',
        summary: 'Também inclui o termo procurado.',
        keywords: [],
        blocks: [],
      },
    ];

    expect(
      searchHelp(createHelpSearchIndex(pagesWithTie), 'termo').map((result) => result.page.id),
    ).toEqual(['what-is-keres', 'first-story']);
  });
  it('returns no result when no searchable text matches', () => {
    expect(searchHelp(index, 'inexistente-keres-ajuda')).toEqual([]);
  });
});
