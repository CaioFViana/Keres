import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'item-journeys',
  title: 'Item journeys',
  summary: 'Record where an item changed state or owner, scene by scene.',
  keywords: ['item', 'journey', 'owner', 'state'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A journey is one stop in an Item’s story. It records which Scene changes it, its new state, and, when applicable, its new owner.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'The key begins rusted with Lia. In the “Market” Scene, a journey records New character owner: Omar and New state: repaired.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Item journeys', '+'] },
    {
      type: 'steps',
      items: [
        'Choose the Item that changed.',
        'Choose the Scene where the change happens.',
        'Fill in New state.',
        'Choose New character owner only if the item passes to someone.',
        'Save and add Tags, Notes, or See also when you need context.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'item',
          label: 'Item',
          whatToWrite: 'Choose the object whose journey you are recording. It is needed to save.',
          note: 'The stop appears in that item’s journey.',
        },
        {
          key: 'scene',
          label: 'Scene',
          whatToWrite: 'Choose the Scene where the change happens. It is needed to save.',
          note: 'It links the change to the narrative point where it happened.',
        },
        {
          key: 'newCharacterOwner',
          label: 'New character owner',
          whatToWrite: 'Choose who receives the item; leave empty if ownership does not change.',
          note: 'It differs from the initial owner in the Item profile.',
        },
        {
          key: 'newState',
          label: 'New state',
          whatToWrite: 'Describe how the item is after this Scene. It is needed to save.',
          note: 'It suggests states already used in the story.',
        },
        {
          key: 'extraNotes',
          label: 'Extra notes',
          whatToWrite: 'Explain why the change happened or record a continuity detail.',
          note: 'They remain with the stop and can receive comments.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The journey appears when consulting the Item and links its change to a Scene. Deleting a stop does not delete the Item or change its Initial state.',
    },
    { type: 'seeAlso', pages: ['items', 'scenes', 'effects'] },
  ],
};
export default page;
