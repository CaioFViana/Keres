import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { helpPageIds } from '../../src/help/catalog';
import { screenHelpPage } from '../../src/help/contextualHelp';

it('maps every contextual help target to a catalog page', () => {
  for (const pageId of Object.values(screenHelpPage)) expect(helpPageIds).toContain(pageId);
});

it('covers every application screen with a reader-facing header', () => {
  const navigationDirectory = join(__dirname, '../../src/navigation');
  const navigators = ['MainSystemStack.tsx', 'StorySelectionStack.tsx'];
  const routeNames = navigators.flatMap((fileName) =>
    Array.from(
      readFileSync(join(navigationDirectory, fileName), 'utf8').matchAll(
        /<[A-Za-z]+\.Screen\s+name="([^"]+)"/g,
      ),
      (match) => match[1],
    ),
  );
  const intentionallyUnmapped = new Set(['HelpDrawer', 'StorySelection']);

  for (const routeName of new Set(routeNames)) {
    if (!intentionallyUnmapped.has(routeName)) expect(screenHelpPage[routeName]).toBeDefined();
  }
});
