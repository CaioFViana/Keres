import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'character-modes',
  title: 'Character modes',
  summary: 'Record the different forms a character takes across the story.',
  keywords: ['mode', 'form', 'transformation', 'state', 'character'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A mode is one version of a character at some point in the story: after a training arc, under a curse, in armour. Every character always has a normal mode, and modes are extra versions beside it.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Ilda has the mode “In the storm”, whose changes read “loses her fear of the sea, forgets the map”. When the story uses stats, that mode can also carry its own values.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Characters', 'a character', 'Edit'] },
    {
      type: 'steps',
      items: [
        'Open the character and choose Edit. Modes are created and edited on the form, never on the detail page.',
        'In Modes, add a mode with a name and a description of what changes.',
        'Save. The mode appears on the character detail page, and in global search by its name.',
        'With the stat system on, the character panel lets you switch between the normal mode and each mode.',
      ],
    },
    {
      type: 'fields',
      rows: [
        {
          key: 'name',
          label: 'Name',
          whatToWrite: 'How this form is recognized. Fill it in to save.',
          note: 'Appears in the mode selector and in search.',
        },
        {
          key: 'modeChanges',
          label: 'What changes',
          whatToWrite: 'What is different about the character in this form.',
          note: 'Free text; nothing here is interpreted by the app.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Modes do not depend on the stat system and exist in any story. When stats are on, deleting a mode also removes the stat values recorded only for it; the character keeps the values of the normal mode.',
    },
    { type: 'seeAlso', pages: ['characters', 'stats'] },
  ],
};
export default page;
