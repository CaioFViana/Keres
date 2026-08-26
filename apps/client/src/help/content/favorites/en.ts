import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'favorites',
  title: 'Favorites',
  summary: 'Highlight important stories and elements and choose how this works with collaborators.',
  keywords: ['star', 'favorite', 'favorites', 'filter', 'sharing'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Favorites are stars for finding stories, characters, scenes, and other elements again quickly. In a shared story, the behavior chosen in Story settings determines whether the star is the same for everyone or personal.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'While revising, you mark three scenes that need attention. The favorites filter shows them without mixing in every other scene. If collaborators have different priorities, use individual favorites so one person does not change another person’s list.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'In an element list, tap the star on its card, or open its details and tap the star in the header.',
        'Use the favorites filter in the list to show only starred entries.',
        'To choose how favorites work for the story, open Story menu › Story settings and choose Favorite behavior.',
        'Choose Global for one shared list; Individual for a private list for each person; or Public individual for a personal list where people can see who starred an element.',
        'Save Story settings. Only someone who can edit the story can change this behavior.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'In a local story, favorites are only for your own organization. The difference between the three behaviors matters when the story is connected to a server and has collaborators.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The star changes the filter and the marker shown in lists, cards, and details. In Global mode, a change appears for every collaborator. In Public individual mode, the details can show who favorited an element; in Individual mode, that information is not shared.',
    },
    {
      type: 'seeAlso',
      pages: ['lists-and-search', 'story-settings', 'collaborators', 'sync-basics'],
    },
  ],
};
export default page;
