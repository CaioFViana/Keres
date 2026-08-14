import { helpPageIds } from '../../src/help/catalog';
import { screenHelpPage } from '../../src/help/contextualHelp';

it('maps every contextual help target to a catalog page', () => {
  for (const pageId of Object.values(screenHelpPage)) expect(helpPageIds).toContain(pageId);
});
