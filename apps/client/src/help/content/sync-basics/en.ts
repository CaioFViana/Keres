import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sync-basics',
  title: 'How synchronization works',
  summary: 'Work offline and send changes when a story is connected to a server.',
  keywords: ['synchronize', 'offline', 'server', 'media'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Synchronization keeps a story’s local copy and server copy up to date when a connection is available.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You write on a train without internet; once online again, changes and media for the server-connected story are sent.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Add a server and send the story from Story settings.',
        'Keep working even while offline.',
        'When connected, wait for synchronization; the server list shows the latest synchronization.',
        'Resolve a conflict if the app opens its matching dialog.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Local stories are not sent automatically. Synchronized stories can appear on other devices, to collaborators, in activity history, and in account media limits.',
    },
    { type: 'seeAlso', pages: ['what-is-a-server', 'sync-conflicts', 'activity-log'] },
  ],
};
export default page;
