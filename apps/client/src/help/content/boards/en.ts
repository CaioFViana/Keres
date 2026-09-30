import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'boards',
  title: 'Boards',
  summary:
    'Small freeform sketches of the story dictionary: pins, notes and arrows that are not relations.',
  keywords: [
    'board',
    'corkboard',
    'canvas',
    'pin',
    'sketch',
    'map',
    'shape',
    'draw',
    'stamp',
    'frame',
    'line',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A board is a named drawing. You pin characters, locations, scenes and other dictionary entries, drop free notes, and connect them. Those links belong only to the board — they do not become character relations or “see also” links.',
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
        'Above the board, Add an entity opens the picker to pin existing entities. The same entity can be pinned more than once.',
        'Add note is for something that is not an entity yet. Add objects draws shapes, lines and stamps - see below.',
        'Drag a pin to move it. Tap it to open its profile or edit its note.',
        'To create a link, turn on Connect nodes in the bar above the board and drag from one pin to another. Connect nodes, Edit objects and Edit layout are exclusive: turning one on turns the others off.',
        'In the dialog, choose whether the link is directional, its arrow direction, and optional text.',
        'Save with the checkmark in the header; the undo arrow (Revert) goes back to the last saved drawing. Both stay dimmed until something changes.',
      ],
    },
    { type: 'heading', level: 2, text: 'Shapes, lines, and stamps' },
    {
      type: 'paragraph',
      text: 'Besides pins and notes, a board takes drawn objects: a frame around the conspirators, a line marking a border, a star on the key scene. They are decoration and grouping only; nothing drawn becomes a relation or changes the story.',
    },
    {
      type: 'steps',
      items: [
        'Open Add objects (shapes icon) and choose a group: Draw (rectangle, ellipse, frame, line, polygon), Ready-made shapes (square, diamond, triangle, pentagon, hexagon, star) or Stamp (an icon).',
        'Rectangle, ellipse, frame and the ready-made shapes are drawn by dragging across the canvas. For a line, tap to place each point, then Finish; a polygon closes itself when you finish. For a stamp, tap where it goes. Cancel leaves without creating anything.',
        'Turn on Edit objects to select one: it shows handles to move it or drag its points and corners, and a column with Edit details, Bring to front, Send to back, Lock object and Deselect.',
        'Edit details sets its label, color, and whether it is dashed or filled, or which icon a stamp shows. Remove deletes it.',
        'A locked object can still be selected and edited in its details, but cannot be moved or reshaped until you unlock it.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Objects are saved, shared and exported together with the drawing, in the PNG or SVG you chose in App settings.',
    },
    { type: 'heading', level: 2, text: 'Links on a board' },
    {
      type: 'paragraph',
      text: 'A plain link represents an association. A directional link shows an arrow; choose A → B or B → A in the dialog. Its optional text appears over the line, for example “protects”, “discovered”, or “leads to”.',
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
      text: 'Changes you have not saved are kept on this device, per board, even if you close the app or open an entity from a pin. The next time you open the board they come back with a notice. If the saved board changed in the meantime, the notice says so; use Revert to drop your draft and keep the saved one.',
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
      text: 'Boards do not change the story map, the location graph, or character relations. Links and their text stay on that board. Saving writes one update for the whole drawing, so two people editing the same board resolve it as keep-mine, keep-theirs, or a copy — the drawings are not merged.',
    },
  ],
};
export default page;
