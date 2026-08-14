import { helpPageIds, helpSections } from '../catalog';
import { getHelpPage } from '../repository';

describe('help catalog', () => {
  it('has a page in both supported languages for every catalog entry', () => {
    for (const id of helpPageIds) {
      expect(getHelpPage(id, 'pt')).toBeDefined();
      expect(getHelpPage(id, 'en')).toBeDefined();
    }
  });
  it('contains no duplicate entries', () => {
    expect(new Set(helpPageIds).size).toBe(helpPageIds.length);
    expect(helpSections).toHaveLength(9);
  });
});
