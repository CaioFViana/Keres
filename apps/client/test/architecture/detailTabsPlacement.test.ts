/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const srcRoot = resolve(__dirname, '../../src');

/** Every detail screen that is divided into the Details, Relations and Other tabs. */
const TABBED_SCREENS = [
  'screens/characters/CharacterDetailContent.tsx',
  'screens/narrative-elements/scenes/SceneDetailContent.tsx',
  'screens/items/ItemDetailScreen.tsx',
  'screens/locations/LocationDetailsScreen.tsx',
  'screens/notes/NoteDetailScreen.tsx',
  'screens/worldrules/WorldRuleDetailScreen.tsx',
  'screens/narrative-elements/chapters/ChapterDetailScreen.tsx',
  'screens/narrative-elements/choices/ChoiceDetailScreen.tsx',
  'screens/itemJourneys/ItemJourneyDetailScreen.tsx',
];

type Panels = { details: string; relations: string; other: string };

/** The source of each panel: from its `const xPanel =` to the next one (the last, to the screen's `return`). */
function panelsOf(file: string): Panels {
  const source = readFileSync(resolve(srcRoot, file), 'utf8');
  const at = (name: string) => source.indexOf(`const ${name}Panel = `);
  const details = at('details');
  const relations = at('relations');
  const other = at('other');
  expect([details, relations, other].every((index) => index >= 0)).toBe(true);
  expect(details).toBeLessThan(relations);
  expect(relations).toBeLessThan(other);
  const end = source.indexOf('  return (', other);
  return {
    details: source.slice(details, relations),
    relations: source.slice(relations, other),
    other: source.slice(other, end),
  };
}

/** What belongs on the Other tab, whatever the entity. */
const OTHER_ONLY = ['CustomAttributeDetailFields', 'FavoritedByList', 'EntityMetadata'];
/** The managers and lists of linked entities belong on the Relations tab. */
const RELATIONS_ONLY = [
  'NoteManager',
  'SeeAlsoManager',
  'AppearsInArcsSection',
  'RelatedScenesList',
];
/** The entity's own media is part of what it is. */
const DETAILS_ONLY = ['EntityGalleryManager'];

describe('tabbed detail screens', () => {
  it.each(TABBED_SCREENS)('%s keeps each section on its tab', (file) => {
    const panels = panelsOf(file);
    const places: [string[], keyof Panels][] = [
      [OTHER_ONLY, 'other'],
      [RELATIONS_ONLY, 'relations'],
      [DETAILS_ONLY, 'details'],
    ];

    const misplaced: string[] = [];
    for (const [components, home] of places) {
      for (const component of components) {
        for (const tab of ['details', 'relations', 'other'] as const) {
          if (tab !== home && panels[tab].includes(`<${component}`)) {
            misplaced.push(`<${component}> is on the ${tab} tab, it belongs on ${home}`);
          }
        }
      }
    }

    expect(misplaced).toEqual([]);
  });

  it.each(TABBED_SCREENS)('%s puts the entity record on the Other tab', (file) => {
    expect(panelsOf(file).other).toContain('<EntityMetadata');
  });

  it.each(TABBED_SCREENS)(
    '%s puts the favorites list, when it has one, on the Other tab',
    (file) => {
      const source = readFileSync(resolve(srcRoot, file), 'utf8');

      if (source.includes('<FavoritedByList'))
        expect(panelsOf(file).other).toContain('<FavoritedByList');
    },
  );

  it.each(TABBED_SCREENS)('%s starts on the details and follows a landing target', (file) => {
    const source = readFileSync(resolve(srcRoot, file), 'utf8');

    expect(source).toMatch(/useDetailTab\(occurrence\)/);
    expect(source).toContain('<DetailTabs tabs={tabItems} value={tab} onChange={setTab} />');
    expect(source).toContain('scrollResetKey={tab}');
    expect(source).toContain('<DetailTabPanels');
  });

  it.each(TABBED_SCREENS)('%s calls its tab hooks before any early return', (file) => {
    const source = readFileSync(resolve(srcRoot, file), 'utf8');
    const hook = source.indexOf('useDetailTab(occurrence)');
    // A component-level early return (two-space indent), not a guard inside one of its callbacks.
    const firstEarlyReturn = source.search(/\n {2}if \((loading|error|!\w+)\)/);

    expect(hook).toBeGreaterThan(0);
    // Hooks that come after a conditional return are skipped on some renders and crash the next.
    if (firstEarlyReturn >= 0) expect(hook).toBeLessThan(firstEarlyReturn);
  });
});
