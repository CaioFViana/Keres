import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'sync-conflicts',
  title: 'Reviewing sync conflicts',
  summary:
    'A banner on the story dashboard lets you reconcile local and server changes without interrupting what you were doing.',
  keywords: ['conflict', 'keep mine', 'server', 'synchronization', 'banner', 'review'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: "A conflict is recorded when the app cannot automatically apply both a local change and a server change to the same element. It never pops up on its own: a red banner appears on the open story's dashboard showing how many conflicts are waiting, and tapping it opens the conflict review sheet.",
    },
    {
      type: 'paragraph',
      text: 'Many edits that used to show up here no longer do: if you and the server changed different fields of the same element, the app merges both sets of changes automatically and only asks you when the same field was genuinely changed on both sides.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You rename a character relationship offline while someone else deletes one of those characters on the server. The dashboard shows a banner with a pending conflict; the review sheet names both characters instead of showing raw ids.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open the story dashboard and tap the conflict banner when it appears.',
        'The review sheet lists conflicts in two groups: relationships and content.',
        'For a relationship, or for a conflict with no field truly in dispute (such as a deletion), tap the checkmark icon to keep your copy or the cloud icon to keep the server copy - no extra screen needed.',
        'For a content conflict with multiple contested fields, tap the row to open the field-by-field comparison, choose Mine or Server for each field, then confirm with Keep mine (or Apply merge, when the fields are mixed) or Keep server.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The choice decides which version synchronizes again. A conflict you have not reviewed yet stays pending and can hold back that specific change from being sent, but it never blocks the rest of the app.',
    },
    {
      type: 'seeAlso',
      pages: ['story-dashboard', 'sync-basics', 'activity-log', 'account-limits'],
    },
  ],
};
export default page;
