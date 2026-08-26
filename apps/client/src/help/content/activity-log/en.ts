import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'activity-log',
  title: 'Activity history',
  summary: 'See synchronized story changes and who made them.',
  keywords: ['activity', 'history', 'logs', 'operation', 'created at', 'updated at'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Activity history gathers recorded changes for a story connected to a server.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'While reviewing a scene, you see that a collaborator updated it yesterday and open the record to understand the change.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Story menu › Operation Logs.',
        'Use the list to find a creation, edit, or link.',
        'Tap a record to see details and its related element.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Created at shows when an element began; Updated at shows its latest change. A local-only story does not have the same shared server history.',
    },
    { type: 'seeAlso', pages: ['sync-basics', 'comments', 'collaborators'] },
  ],
};
export default page;
