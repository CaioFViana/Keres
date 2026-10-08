import type { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'getting-around',
  title: 'Navigating the app',
  summary: 'Use the menu that fits the part of your work you are in.',
  keywords: ['menu', 'back', 'phone', 'wide screen'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Keres has two menus. The main menu handles stories and your account; the story menu shows the elements and tools for the story that is open.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Before opening a story, you use the main menu to import a backup. After opening “The Glass City”, you use the story menu to reach Characters, Scenes, and Story Analysis.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'On a wide screen, use the visible menu on the left; drag its edge to adjust its width.',
        'On a phone, tap the menu icon in the header to open the drawer.',
        'Tap a menu item to return to that subject’s main list.',
        'In the main menu, Story Selection is on top. Create holds Packs, Examples and Import a story; Server (only where there is a server) holds Manage Servers and Manage Friendships; Help and App Settings stay at the bottom. A dot on Manage Friendships or Manage Servers - or on the Server group while it is folded away - says there is a message you have not opened.',
        'In the story menu, the entries are in groups - Write, Components, World, Material, Organize and review - under the story’s name. Tap a group’s name to open or close it: the group with the open screen stays open, and the others stay as you left them, story by story. Search is the box at the top.',
        'In the story menu, small marks say what is behind an entry without opening it: a number on History for changes still to reach the server (red when the server refused some, with a dot on the group while it is folded away), and Published on Publish and export.',
        'Use the arrow in the header, or your device or browser Back button, to return through the screens you opened. A screen a shortcut opened - from the dashboard, say - takes you back to where you were.',
        'Tap Help at the bottom of the menu to search or browse the catalog.',
        'When a header has more actions than fit, they gather under More actions (the burger icon): tap it to see each one with its name.',
        'On a form, the header Reset action asks Discard changes? - on a new item it clears everything typed, on an existing one it restores the saved values. Neither can be undone.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Opening a story changes the available menu but does not alter your data. Going back to Story Selection leaves the story intact and lets you open another one.',
    },
    { type: 'seeAlso', pages: ['story-list', 'using-this-help', 'lists-and-search'] },
  ],
};
export default page;
