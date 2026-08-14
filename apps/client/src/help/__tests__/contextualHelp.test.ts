import { helpPageIds } from '../catalog';
import { screenHelpPage } from '../contextualHelp';

it('maps every contextual help target to a catalog page', () => {
  for (const pageId of Object.values(screenHelpPage)) expect(helpPageIds).toContain(pageId);
});
