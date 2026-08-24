import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'tags',
  title: 'Tags',
  summary: 'Organize tags in your story.',
  keywords: ['tags'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Tags is a feature for recording and connecting story information.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use tags to make a narrative decision easy to consult while revising.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Tags in the Story menu.',
        'Tap + or open an existing record.',
        'Fill in fields and save.',
        'Review links in details.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'The name itself it shows on the Tag.',
          note: 'Keep it short if possible to avoid visual failures.',
        },
        {
          key: 'color',
          label: 'Color',
          whatToWrite: 'The color this Tag shows on their Entities.',
          note: 'Use the color picker to pinpoint it the way you want to.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn on to highlight an important Tag.',
          note: 'It enters the favorites filter.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'What is this Tag for?',
          note: 'Use it to organize each Tag.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Information is available in related lists, details, searches, and links.',
    },
    { type: 'seeAlso', pages: ['lists-and-search', 'see-also', 'comments'] },
  ],
};
export default page;
