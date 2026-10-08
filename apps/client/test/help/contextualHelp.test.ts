import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { helpPageIds } from '../../src/help/catalog';
import { screenHelpPage } from '../../src/help/contextualHelp';

it('maps every contextual help target to a catalog page', () => {
  for (const pageId of Object.values(screenHelpPage)) expect(helpPageIds).toContain(pageId);
});

it('covers every application screen with a reader-facing header', () => {
  const navigationDirectory = join(__dirname, '../../src/navigation');
  // Every navigator file: a screen in a stack of its own (the manuscript export, say) is just as reader-facing.
  const navigators = readdirSync(navigationDirectory).filter((fileName) =>
    fileName.endsWith('.tsx'),
  );
  const routeNames = navigators.flatMap((fileName) =>
    Array.from(
      readFileSync(join(navigationDirectory, fileName), 'utf8').matchAll(
        /<[A-Za-z]+\.Screen\s+name="([^"]+)"/g,
      ),
      (match) => match[1],
    ),
  );
  // The two documentation libraries have no contextual shortcut: the destination page would be
  // themselves.
  const intentionallyUnmapped = new Set([
    'HelpDrawer',
    'HelpIndex',
    'HelpPage',
    'StoryDevicesDrawer',
    'DeviceIndex',
    'DevicePage',
    'StorySelection',
    // Not screens a person reads: the app's shell and the first-install gate.
    'MainSystem',
    'ColdInstall',
    'ColdInstallScreen',
  ]);

  for (const routeName of new Set(routeNames)) {
    if (!intentionallyUnmapped.has(routeName)) expect(screenHelpPage[routeName]).toBeDefined();
  }
});
