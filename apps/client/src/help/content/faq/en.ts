import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'faq',
  title: 'Frequently asked questions',
  summary: 'Find short answers and paths to detailed pages.',
  keywords: ['questions', 'help', 'offline', 'backup', 'server'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Frequently asked questions gathers quick answers to common questions about stories, servers, and data.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You need to know whether importing deletes a story: the quick answer says it does not and points to a detailed page when needed.',
    },
    { type: 'heading', level: 3, text: 'Quick answers' },
    {
      type: 'faq',
      items: [
        {
          question: 'Can I use Keres without a server?',
          answer:
            'Yes. Local stories work on the device; a server is optional for synchronization and collaboration.',
        },
        {
          question: 'Does importing replace an existing story?',
          answer: 'No. Importing creates a new local story.',
        },
        {
          question: 'How do I back up?',
          answer: 'Export the story and keep the file somewhere safe.',
        },
        {
          question: 'Why does a choice not appear?',
          answer: 'In a branching story, check its source, destination, and conditions.',
        },
        {
          question: 'What should I do when I see a conflict?',
          answer:
            'Compare Mine and Server, choose per field when possible, or postpone it to decide later.',
        },
        {
          question: 'What if I forget my password?',
          answer:
            'Use a recovery code you saved when you created the account: tap Forgot your password? when signing in on that server.',
        },
      ],
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Use Help search to find a word from your question.',
        'Open the detailed page listed in See also when you need more context.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'These answers do not change data; they point to the feature that performs each action.',
    },
    {
      type: 'seeAlso',
      pages: ['using-this-help', 'what-is-a-server', 'data-and-backup', 'sync-conflicts'],
    },
  ],
};
export default page;
