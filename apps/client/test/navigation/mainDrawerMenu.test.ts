import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildMainDrawerMenu,
  isLeafActive,
  type MenuLeaf,
} from '../../src/navigation/mainDrawerMenu';

const build = (showLiteraryDevices = false) =>
  buildMainDrawerMenu({
    t: (key) => key,
    term: (key) => `term:${key}`,
    showLiteraryDevices,
  });

const leavesOf = (groupId: string) =>
  build()
    .groups.find((group) => group.id === groupId)!
    .leaves.map((leaf) => leaf.id);

describe('the story menu model', () => {
  it('groups the entries as agreed, in order', () => {
    expect(build().groups.map((group) => group.id)).toEqual([
      'write',
      'components',
      'world',
      'material',
      'review',
    ]);
    expect(leavesOf('write')).toEqual([
      'MainDashboard',
      'NarrativeElementsStack',
      'Manuscript',
      'StoryShare',
    ]);
    expect(leavesOf('components')).toEqual([
      'CharactersStack',
      'LocationsStack',
      'ItemsStack',
      'PlotsStack',
      'StatsStack',
    ]);
    expect(leavesOf('material')).toEqual([
      'GalleryStack',
      'BoardsStack',
      'SketchStack',
      'SongStack',
    ]);
    expect(build().footer.map((leaf) => leaf.id)).toEqual([
      'StorySettings',
      'HelpDrawer',
      'StorySelection',
    ]);
  });

  it('lists the world as all pieces, six categories and the calendars', () => {
    expect(leavesOf('world')).toEqual([
      'WorldRulesStack',
      'WorldRulesStack:rule',
      'WorldRulesStack:people',
      'WorldRulesStack:mythology',
      'WorldRulesStack:knowledge',
      'WorldRulesStack:fauna',
      'WorldRulesStack:flora',
      'CalendarsStack',
    ]);
  });

  it('puts the search above the groups and nowhere inside them', () => {
    const menu = build(true);

    expect(menu.top.map((leaf) => leaf.id)).toEqual(['GlobalSearch']);
    expect(menu.groups.flatMap((group) => group.leaves.map((leaf) => leaf.id))).not.toContain(
      'GlobalSearch',
    );
  });

  it('names the characters, places and items the way the story does', () => {
    const labels = build()
      .groups.find((group) => group.id === 'components')!
      .leaves.map((l) => l.label);
    expect(labels.slice(0, 3)).toEqual(['term:Character', 'term:Location', 'term:Item']);
  });

  it('offers the literary devices only to whoever turned them on', () => {
    expect(leavesOf('review')).not.toContain('StoryDevicesDrawer');
    const withDevices = build(true).groups.find((group) => group.id === 'review')!;
    expect(withDevices.leaves.map((leaf) => leaf.id)).toContain('StoryDevicesDrawer');
  });

  it('opens a few groups at the start and keeps the long ones shut', () => {
    expect(
      Object.fromEntries(build().groups.map((group) => [group.id, group.defaultOpen])),
    ).toEqual({
      write: true,
      components: true,
      world: false,
      material: true,
      review: false,
    });
  });

  it('only names routes the drawer registers', () => {
    const source = readFileSync(
      join(__dirname, '../../src/navigation/MainSystemStack.tsx'),
      'utf8',
    );
    const registered = new Set(
      Array.from(source.matchAll(/<Drawer\.Screen\s+name="([^"]+)"/g), (match) => match[1]),
    );
    const menu = build(true);
    const named = [...menu.top, ...menu.groups.flatMap((group) => group.leaves), ...menu.footer];

    expect(named.filter((leaf) => !registered.has(leaf.route)).map((leaf) => leaf.id)).toEqual([]);
  });
});

describe('which entry is on screen', () => {
  const leaf = (id: string) =>
    [...build().groups.flatMap((group) => group.leaves), ...build().footer].find(
      (candidate): candidate is MenuLeaf => candidate.id === id,
    )!;

  it('tells the manuscript from the chapter list inside the same stack', () => {
    expect(
      isLeafActive(leaf('Manuscript'), 'NarrativeElementsStack', { screen: 'Manuscript' }),
    ).toBe(true);
    expect(
      isLeafActive(leaf('Manuscript'), 'NarrativeElementsStack', { screen: 'ManuscriptExport' }),
    ).toBe(true);
    expect(
      isLeafActive(leaf('NarrativeElementsStack'), 'NarrativeElementsStack', {
        screen: 'Manuscript',
      }),
    ).toBe(false);
    expect(
      isLeafActive(leaf('NarrativeElementsStack'), 'NarrativeElementsStack', {
        screen: 'SceneEditor',
      }),
    ).toBe(true);
  });

  it('tells the world categories apart, and gives a piece open on its own to "all"', () => {
    const onFauna = { screen: 'WorldRules', params: { section: 'fauna' } };
    expect(isLeafActive(leaf('WorldRulesStack:fauna'), 'WorldRulesStack', onFauna)).toBe(true);
    expect(isLeafActive(leaf('WorldRulesStack:flora'), 'WorldRulesStack', onFauna)).toBe(false);
    expect(isLeafActive(leaf('WorldRulesStack'), 'WorldRulesStack', onFauna)).toBe(false);
    expect(isLeafActive(leaf('WorldRulesStack'), 'WorldRulesStack', { screen: 'WorldRules' })).toBe(
      true,
    );
    expect(
      isLeafActive(leaf('WorldRulesStack'), 'WorldRulesStack', { screen: 'WorldRuleDetail' }),
    ).toBe(true);
  });

  it('is never on screen for another route', () => {
    expect(isLeafActive(leaf('CharactersStack'), 'ItemsStack', {})).toBe(false);
    expect(isLeafActive(leaf('CharactersStack'), 'CharactersStack', {})).toBe(true);
  });
});
