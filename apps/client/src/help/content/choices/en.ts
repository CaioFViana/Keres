import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'choices',
  title: 'Choices',
  summary: 'Organize choices in your story.',
  keywords: ['choices'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Choices is a feature for recording and connecting story information.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use choices to make a narrative decision easy to consult while revising.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Choices in the Story menu.',
        'Tap + or open an existing record.',
        'Fill in fields and save.',
        'Review links in details.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'text',
          label: 'Text',
          whatToWrite: 'Enter the information that describes this choices.',
          note: 'It appears in details and related tools.',
        },
        {
          key: 'sourceScene',
          label: 'Source scene',
          whatToWrite: 'Enter the information that describes this choices.',
          note: 'It appears in details and related tools.',
        },
        {
          key: 'destinationScene',
          label: 'Destination scene',
          whatToWrite: 'Enter the information that describes this choices.',
          note: 'It appears in details and related tools.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Enter the information that describes this choices.',
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
