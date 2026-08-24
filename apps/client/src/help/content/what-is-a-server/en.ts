import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'what-is-a-server',
  title: 'What is a Keres server?',
  summary: 'Understand when to use a server for synchronization and collaboration.',
  keywords: ['server', 'offline', 'synchronize', 'collaborate'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A Keres server is an optional place where an account keeps a synchronized copy of stories. It lets you work on more than one device and share a story with collaborators.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You plan on a laptop without internet and later the app synchronizes the story to your server. On your phone, sign into the same account and continue revising. Without a server, the story still works on the device where it was created.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'From the main menu, open Servers.',
        'Add a server or sign in to an existing account.',
        'Open a story and use Story settings to send it to the server when you want to synchronize it.',
        'To work together, add collaborators to a story sent to a server.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Stories without a server remain local. Stories connected to a server can synchronize media, show activity, use collaboration, and require conflict resolution when the same information is changed in different places.',
    },
    { type: 'seeAlso', pages: ['add-server', 'sync-basics', 'collaborators', 'data-and-backup'] },
  ],
};
export default page;
