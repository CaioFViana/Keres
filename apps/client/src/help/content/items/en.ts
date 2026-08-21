import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'items',
  title: 'Items',
  summary: 'Track important objects, their initial state, and who owns them.',
  keywords: ['object', 'initial state', 'owner', 'journey'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Items are objects relevant to the narrative. Their profile records how an object begins; its journey records later state or owner changes.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'A key can begin “rusted” with Lia as its owner. In the market scene, its journey can record that it passed to Omar and was repaired.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Items', '+'] },
    {
      type: 'steps',
      items: [
        'Create the item and fill in Name.',
        'Use Category and Initial state when they help organize your collection.',
        'Choose Character owner if someone already owns the item at the start.',
        'Save to add Tags, Notes, media, custom attributes, and See also.',
        'Use Item journeys to record changes that happen in scenes.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'How you recognize the object. Fill it in to save.',
          note: 'Appears in lists, searches, and journeys.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite: 'The item’s appearance, function, or importance.',
          note: 'It appears in details and can receive comments.',
        },
        {
          key: 'category',
          label: 'Category',
          whatToWrite: 'A group such as weapon, letter, or relic.',
          note: 'Suggests values already used in the story.',
        },
        {
          key: 'initialState',
          label: 'Initial state',
          whatToWrite: 'How the item is before any recorded change.',
          note: 'It differs from the state at each journey stop.',
        },
        {
          key: 'characterOwnerId',
          label: 'Character owner',
          whatToWrite: 'Who begins with the item, if anyone.',
          note: 'Details show the selected character’s name.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Reminders that do not fit other fields.',
          note: 'They appear in details and can receive comments.',
        },
        {
          key: 'isFavorite',
          label: 'Favorite',
          whatToWrite: 'Turn on to highlight the item.',
          note: 'It enters the favorites filter.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The item can appear in journeys, effects, conditions, searches, media, and links. Removing a journey does not delete the item; deleting it requires reviewing those references.',
    },
    { type: 'seeAlso', pages: ['item-journeys', 'effects', 'choice-conditions', 'gallery'] },
  ],
};
export default page;
