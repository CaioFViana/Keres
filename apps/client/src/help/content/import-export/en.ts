import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'import-export',
  title: 'Import and export',
  summary: 'Save a story copy or create a new one from an exported file.',
  keywords: ['backup', 'export', 'import', 'file'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Export prepares a copy of a story to keep or transfer. Import reads an exported copy and creates another story in your list.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Before restructuring “The Glass City”, export a copy. To test another version, import that copy: the original remains in your list.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Main menu', 'Import and export'] },
    {
      type: 'steps',
      items: [
        'Choose Export and select the story you want to keep.',
        'Save or share the file in a secure place you choose.',
        'To import, choose the exported file and confirm creation.',
        'Open the new story from the list and check the data before editing.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Import does not replace an existing story: it creates a new copy. Export does not change the story. Older-version files may not be accepted if the app cannot read them safely.',
    },
    { type: 'seeAlso', pages: ['data-and-backup', 'story-list', 'example-stories'] },
  ],
};
export default page;
