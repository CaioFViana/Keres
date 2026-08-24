import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'world-rules',
  title: 'World rules',
  summary: 'Keep limits and facts that make the world coherent.',
  keywords: ['rule', 'world', 'continuity'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A world rule records a limit or fact that your narrative must respect.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: '“Teleportation only works between marked mirrors” prevents contradictory solutions in future scenes.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Story menu › World rules.',
        'Create a rule and enter Title.',
        'Explain the rule in Description and save.',
        'Use Tags, Notes, and See also to connect it to scenes or characters.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Title',
          whatToWrite: 'A short name for the rule. Fill it in to save.',
          note: 'Appears in lists and searches.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite: 'The limit, fact, or consequence to respect.',
          note: 'It is the main text for consultation and comments.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn on to highlight an important rule.',
          note: 'It enters the favorites filter.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Exceptions, ideas, or reminders.',
          note: 'They remain in rule details.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The rule does not automatically block actions in the app; it is a reference for your scenes, notes, searches, and reviews.',
    },
    { type: 'seeAlso', pages: ['scenes', 'notes', 'see-also'] },
  ],
};
export default page;
