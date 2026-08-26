import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'notes',
  title: 'Notes',
  summary: 'Organize notes in your story.',
  keywords: ['notes'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Notes is a feature for recording and connecting story information.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use notes to make a narrative decision easy to consult while revising.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Notes in the Story menu.',
        'Tap + or open an existing record.',
        'Fill in fields and save.',
        'Review links in details.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Title',
          whatToWrite: 'A short title to describe the note.',
          note: 'It appears in details and related entities.',
        },
        {
          key: 'body',
          label: 'Body',
          whatToWrite: 'The actual information of this note.',
          note: 'Shows when clicked. Good to write more details.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn on to highlight an important note.',
          note: 'It enters the favorites filter.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Even more details that is not worth adding to the body of the main note.',
          note: 'They remain in note details.',
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
