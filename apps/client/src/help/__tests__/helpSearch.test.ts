import { getHelpPages } from '../repository';
import { searchHelp } from '../search';

describe('help search', () => {
  const pages = getHelpPages('pt');
  it('matches accents and case-insensitively', () =>
    expect(searchHelp(pages, 'HISTORIA').some((result) => result.page.id === 'what-is-keres')).toBe(
      true,
    ));
  it('matches keywords', () =>
    expect(searchHelp(pages, 'inventario').some((result) => result.page.id === 'story-state')).toBe(
      true,
    ));
  it('prioritizes titles', () =>
    expect(searchHelp(pages, 'personagens')[0]?.page.id).toBe('characters'));
});
