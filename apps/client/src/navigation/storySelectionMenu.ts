import type { MenuGroup, MenuLeaf } from './drawerMenuModel';

export type SelectionGroupId = 'create' | 'server';

export interface StorySelectionMenuModel {
  /** The stories themselves: where everything starts and ends. */
  top: MenuLeaf[];
  groups: MenuGroup<SelectionGroupId>[];
  footer: MenuLeaf[];
}

export interface StorySelectionMenuInput {
  t: (key: string) => string;
  /** A build with no server has nothing to put in the server group, so the group is not there at all. */
  serverless: boolean;
}

/**
 * The menu outside any story: the list of stories, what starts a new one (packs, examples, a file), what
 * belongs to a server (the servers, the friends on them), and help and settings that are always at hand.
 * Taking a story out - publishing, exporting - is in the story's own menu.
 */
export function buildStorySelectionMenu({
  t,
  serverless,
}: StorySelectionMenuInput): StorySelectionMenuModel {
  const groups: MenuGroup<SelectionGroupId>[] = [
    {
      id: 'create',
      labelKey: 'drawer_group_create',
      icon: 'add-circle-outline',
      defaultOpen: true,
      leaves: [
        {
          id: 'PacksDrawer',
          route: 'PacksDrawer',
          label: t('packs_title'),
          icon: 'archive-outline',
        },
        {
          id: 'ExampleStories',
          route: 'ExampleStories',
          label: t('examples_title'),
          icon: 'flask-outline',
        },
        {
          id: 'ImportStory',
          route: 'ImportStory',
          label: t('import_story_title'),
          icon: 'download-outline',
        },
      ],
    },
  ];

  if (!serverless) {
    groups.push({
      id: 'server',
      labelKey: 'drawer_group_server',
      icon: 'cloud-outline',
      defaultOpen: true,
      leaves: [
        {
          id: 'ServerManagementDrawer',
          route: 'ServerManagementDrawer',
          label: t('manage_servers'),
          icon: 'server-outline',
        },
        {
          id: 'FriendshipDrawer',
          route: 'FriendshipDrawer',
          label: t('manage_friendships'),
          icon: 'people-outline',
        },
      ],
    });
  }

  return {
    top: [
      {
        id: 'StorySelectionMain',
        route: 'StorySelectionMain',
        label: t('story_selection_title'),
        icon: 'book-outline',
      },
    ],
    groups,
    footer: [
      {
        id: 'HelpDrawer',
        route: 'HelpDrawer',
        label: t('help_title'),
        icon: 'help-circle-outline',
      },
      { id: 'Settings', route: 'Settings', label: t('settings_title'), icon: 'settings-outline' },
    ],
  };
}
