import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'world-rules',
  title: 'World and world pieces',
  summary: 'Organize the rules, creatures, flora, mythology, peoples, and knowledge of your setting.',
  keywords: ['world', 'bestiary', 'herbarium', 'mythology', 'creature', 'continuity'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A world piece records something important to the setting. It can be a natural rule, creature, plant, deity, culture, or body of knowledge.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Examples',
      text: '“Teleportation only works between marked mirrors” is a Rule. “Ember doe” belongs in the Bestiary. “Ash lily” belongs in the Herbarium.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Story menu › World.',
        'Choose All world pieces or a section, such as Bestiary or Mythology.',
        'Create a piece, enter its Title, and choose its Section.',
        'Use Type to classify it within the Section, then fill any other fields that help.',
        'Use World content & relations to connect it to locations, other pieces, or story entities.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'title',
          label: 'Title',
          whatToWrite: 'A short name for the piece. Fill it in to save.',
          note: 'Appears in lists and searches.',
        },
        {
          key: 'section',
          label: 'Section',
          whatToWrite: 'The fixed group: Rules, Bestiary, Herbarium, Mythology, Peoples & cultures, World knowledge, or Other.',
          note: 'It organizes the World drawer; use All world pieces to search across groups.',
        },
        {
          key: 'type',
          label: 'Type',
          whatToWrite: 'A free classification such as creature, fungus, deity, culture, or era.',
          note: 'Type suggestions are separate for each Section.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite: 'What the piece is, how it works, or why it matters.',
          note: 'It is the main text for consultation and comments.',
        },
        { key: 'category', label: 'Category', whatToWrite: 'An optional complementary classification.', note: 'Reuses story suggestions.' },
        { key: 'behavior', label: 'Behavior', whatToWrite: 'How the creature, people, system, or concept acts.', note: 'Optional.' },
        { key: 'usability', label: 'Usability', whatToWrite: 'How it can be used, explored, or applied.', note: 'Optional; useful for resources, flora, magic, and technology.' },
        { key: 'danger', label: 'Danger', whatToWrite: 'The risk, cost, or threat it presents.', note: 'Optional; not every piece is dangerous.' },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn on to highlight an important piece.',
          note: 'It enters the favorites filter.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Exceptions, ideas, or reminders.',
          note: 'They remain in piece details.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'A piece does not automatically block actions in the app; it is a reference that can connect to scenes, notes, locations, characters, and other pieces. Entity custom attributes can also point to a world piece.',
    },
    { type: 'seeAlso', pages: ['scenes', 'notes', 'see-also'] },
  ],
};
export default page;
