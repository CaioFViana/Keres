import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'boards',
  title: 'Boards',
  summary:
    'Small freeform sketches of the story dictionary: pins, notes and arrows that are not relations.',
  keywords: ['board', 'corkboard', 'canvas', 'pin', 'sketch', 'map'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A board is a named drawing. You pin characters, locations, scenes and other dictionary entries, drop free notes, and connect them with arrows. Those arrows belong only to the board — they do not become character relations or “see also” links.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You keep one board for the royal family and another for the Act II conspiracy. Each stays small enough to rearrange by hand. The story map and the location graph stay automatic and faithful to the model.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Boards in the story menu and create a board with a short name.',
        'Add existing entities from the picker. The same entity can be pinned more than once.',
        'Add a note for something that is not an entity yet.',
        'Drag a pin to move it. Tap it to connect it to another pin on this board, or to open the entity.',
        'Save explicitly. Revert restores the last saved drawing. Opening an entity keeps the unsaved drawing in memory until you save, close the app, or open another board.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'A short title for this sketch. Required to save the board.',
          note: 'This is how the board shows up in the list and in search.',
        },
        {
          key: 'description',
          label: 'Description',
          whatToWrite:
            'Optional note on what this board is for (the conspiracy, the family, Act II).',
          note: 'Does not appear on the canvas. Used in the list and in search.',
        },
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'If two people save the same board, Keres will not merge the drawings. Keep yours, keep theirs, or keep theirs and save yours as another board.',
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Deleting a character (or any pinned entity) does not break the board. The pin stays as a “deleted entity” until you remove it, and it comes back to life if the entity is restored.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Boards do not change the story map, the location graph, or character relations. Arrows on a board stay on that board. Opening a pinned entity keeps the unsaved drawing in memory until you save, close the app, or open another board. Saving writes one update for the whole drawing, so two people editing the same board resolve it as keep-mine, keep-theirs, or a copy — the drawings are not merged.',
    },
  ],
};
export default page;
