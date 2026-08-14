import { HelpPage } from '../../types';
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
          whatToWrite: 'Enter the information that describes this tags.',
          note: 'It appears in details and related tools.',
        },
        {
          key: 'color',
          label: 'Color',
          whatToWrite: 'Enter the information that describes this tags.',
          note: 'It appears in details and related tools.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Enter the information that describes this tags.',
          note: 'It appears in details and related tools.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Enter the information that describes this tags.',
          note: 'It appears in details and related tools.',
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
