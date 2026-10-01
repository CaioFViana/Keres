import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'guided-tours',
  title: 'Guided tours',
  summary:
    'Short first-open tours walk each screen once — skip any of them, or switch them all off in Settings.',
  keywords: ['tour', 'tutorial', 'onboarding', 'guide', 'first run', 'skip'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A guided tour is a short overlay that appears the first time a screen opens: it highlights one thing at a time — a list, a section, a menu group — and explains it in one or two sentences. Tours never have more than four steps, and Skip is always visible.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You open the story dashboard for the first time. A tour points at the overview panel, then opens the side menu itself to show where stories are built, where they are organized, and where the settings live — four steps, then it never shows again.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open any screen for the first time: its tour starts on its own.',
        'Read each step and move with Next — or Back to re-read.',
        'Skip any tour at any step; skipping counts as seen, like finishing.',
        'Each step also offers this help, for the long version of the same subject.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'A tour only disappears after it is finished or skipped. Leaving the app halfway keeps it unseen, so it shows again next time.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Tours are per device, like the rest of the settings: they work offline and never sync. Their master switch and the reset button live in the app settings.',
    },
    { type: 'path', segments: ['Main menu', 'Settings', 'Show tutorials'] },
    {
      type: 'paragraph',
      text: 'Turning the switch off silences every tour without erasing history; resetting clears the history and switches tours back on, so they show again.',
    },
    { type: 'seeAlso', pages: ['first-story', 'using-this-help', 'app-settings'] },
  ],
};
export default page;
