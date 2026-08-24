import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-devices',
  title: 'Literary devices',
  summary:
    'A reference list of narrative techniques, kept beside the app and separate from your story.',
  keywords: ['literary devices', 'story devices', 'craft', 'writing', 'reference', 'menu'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A second list inside the app, next to this help. Help explains Keres; Literary devices explains the craft of writing: named techniques such as foreshadowing, want versus need, or the ticking clock, with when they help and how they usually fail.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'It was written by someone who is not a scholar of literary theory. The entries summarise terms established elsewhere, and exist to start your own research rather than to replace it.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'paragraph',
      text: 'It is reference material only. Nothing in it reads, changes, or stores anything about your story: there is no field to fill in, no link to an element, and nothing enters import, export, or synchronization.',
    },
    {
      type: 'example',
      title: 'Example',
      text: 'While planning a chapter you want a name for the technique of cutting the scene at its highest tension. You search for "cut", find the cliffhanger entry, read the pitfalls, and go back to writing.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Menu', 'Literary devices'] },
    {
      type: 'steps',
      items: [
        'Open Literary devices from the menu. It appears in both menus, the one for choosing a story and the one inside a story.',
        'Browse by section, or search: the search also matches the English name of each device.',
        'Open an entry and follow its related links at the end of the page.',
        'To hide the menu item, turn off "Suggest literary devices" in App Settings.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Nothing. Turning the setting off only removes the menu item; it does not delete anything, and turning it back on restores the list unchanged.',
    },
    { type: 'seeAlso', pages: ['app-settings', 'using-this-help'] },
  ],
};
export default page;
