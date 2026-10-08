import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'import-export',
  title: 'Import and export',
  summary: 'Save a copy of a story, or create a new one from an exported file.',
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
    { type: 'paragraph', text: 'To bring a story in, from any screen outside a story:' },
    { type: 'path', segments: ['Main menu', 'Import a story'] },
    {
      type: 'steps',
      items: [
        'Choose the exported file and confirm creation.',
        'Open the new story from the list and check the data before editing.',
      ],
    },
    { type: 'paragraph', text: 'To take a copy out, open the story first:' },
    { type: 'path', segments: ['Story menu', 'Publish and export'] },
    {
      type: 'steps',
      items: [
        'Under Copy of the story, choose Data only (.json) or With media (.zip).',
        'Save or share the file in a secure place you choose.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Import does not replace an existing story: it creates a new copy. Export does not change the story. A file made by an older version of Keres is brought up to date as it is imported, prose of the scenes included. A file made by a newer version than your app is refused, with a message: update the app and try again. To get the prose as a document to read or send (Word, PDF, EPUB...), choose Export manuscript on the same screen; the copy is the whole story.',
    },
    { type: 'seeAlso', pages: ['data-and-backup', 'story-list', 'example-stories', 'manuscript'] },
  ],
};
export default page;
