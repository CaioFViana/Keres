import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'troubleshooting',
  title: 'Troubleshooting',
  summary: 'Find safe actions for common app difficulties.',
  keywords: ['problem', 'cannot connect', 'import', 'media', 'story missing'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'This page gathers first steps for connection, session, import, media, and stories that do not appear as expected.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'A media item does not open: check the connection, try its details again, and keep a backup before deleting any data.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'For an unreachable server, check the address and connection, then try again.',
        'For an expired session, open Servers and sign in again.',
        'For a refused import or media item, check format, storage, and account limits.',
        'For a missing story, check the list and correct server, and use exported backups before resetting the app.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Resetting the app removes local data. Export a copy first whenever the story matters; resolve conflicts and limits through the dialog shown.',
    },
    { type: 'seeAlso', pages: ['data-and-backup', 'sync-conflicts', 'add-server'] },
  ],
};
export default page;
