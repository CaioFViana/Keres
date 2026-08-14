import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sync-conflicts',
  title: 'When a conflict appears',
  summary: 'Choose how to reconcile local and server changes.',
  keywords: ['conflict', 'keep mine', 'server', 'synchronization'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A conflict appears when the app cannot automatically apply both a local change and a server change.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You edit a scene description offline while someone else edits that same description on the server. The dialog shows both versions.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Read the reason and element shown in the dialog.',
        'When fields are contested, choose Mine or Server for each field.',
        'Use Keep mine to send your choice or Keep server to discard the local copy.',
        'If deletion is involved, confirm restoring your copy or accepting deletion. Use Postpone only to decide later.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The choice decides which version synchronizes again. While postponed, the conflict remains pending and can stop that change from being sent.',
    },
    { type: 'seeAlso', pages: ['sync-basics', 'activity-log', 'account-limits'] },
  ],
};
export default page;
