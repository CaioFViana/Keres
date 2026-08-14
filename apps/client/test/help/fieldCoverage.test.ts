import { getHelpPage } from '../../src/help/repository';
import { fieldSources } from '../../src/help/fieldSources';

describe('help field coverage', () => {
  it('documents every declared visible field', () => {
    for (const [pageId, fields] of Object.entries(fieldSources)) {
      const page = getHelpPage(pageId, 'pt');
      const documented =
        page?.blocks
          .filter((block) => block.type === 'fields')
          .flatMap((block) => block.rows.map((row) => row.key)) ?? [];
      expect(documented).toEqual(expect.arrayContaining(fields));
    }
  });
});
