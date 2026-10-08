import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildStorySelectionMenu } from '../../src/navigation/storySelectionMenu';

const build = (serverless = false) => buildStorySelectionMenu({ t: (key) => key, serverless });

describe('the menu outside a story', () => {
  it('has the stories on top, then what starts a story, then the server, with help and settings below', () => {
    const menu = build();

    expect(menu.top.map((leaf) => leaf.id)).toEqual(['StorySelectionMain']);
    expect(menu.groups.map((group) => group.id)).toEqual(['create', 'server']);
    expect(menu.groups[0].leaves.map((leaf) => leaf.id)).toEqual([
      'PacksDrawer',
      'ExampleStories',
      'ImportStory',
    ]);
    expect(menu.groups[1].leaves.map((leaf) => leaf.id)).toEqual([
      'ServerManagementDrawer',
      'FriendshipDrawer',
    ]);
    expect(menu.footer.map((leaf) => leaf.id)).toEqual(['HelpDrawer', 'Settings']);
  });

  it('leaves the server group out of a build with no server', () => {
    const menu = build(true);

    expect(menu.groups.map((group) => group.id)).toEqual(['create']);
  });

  it('keeps the literary devices out: they belong to a story', () => {
    const ids = build().groups.flatMap((group) => group.leaves.map((leaf) => leaf.id));

    expect(ids).not.toContain('StoryDevicesDrawer');
  });

  it('only names routes the drawer registers', () => {
    const source = readFileSync(
      join(__dirname, '../../src/navigation/StorySelectionStack.tsx'),
      'utf8',
    );
    const registered = new Set(
      Array.from(source.matchAll(/<Drawer\.Screen\s+name="([^"]+)"/g), (match) => match[1]),
    );
    const menu = build();
    const named = [...menu.top, ...menu.groups.flatMap((group) => group.leaves), ...menu.footer];

    expect(named.filter((leaf) => !registered.has(leaf.route)).map((leaf) => leaf.id)).toEqual([]);
  });
});
