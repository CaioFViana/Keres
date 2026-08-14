import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'account-limits',
  title: 'Account limits',
  summary: 'Understand limits a server can apply to your account.',
  keywords: ['limit', 'storage', 'media', 'account'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Each server can set limits for account stories, elements, and media storage.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'When importing a large video, the server can refuse synchronization if the account has already used all permitted storage.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Read the message shown when creation or synchronization is refused due to a limit.',
        'Free space by removing media or content you do not need to keep on the server, when appropriate.',
        'If you need more capacity, contact the server administrator.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Content remains local until it can synchronize, but a limit conflict requires your decision. Limits and registration rules depend on the server, not the app.',
    },
    { type: 'seeAlso', pages: ['sync-conflicts', 'gallery', 'data-and-backup'] },
  ],
};
export default page;
