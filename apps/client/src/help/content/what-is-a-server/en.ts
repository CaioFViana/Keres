import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'what-is-a-server',
  title: 'What is a Keres server?',
  summary: 'Understand when to use synchronization and collaboration.',
  keywords: ['what is a keres server?', 'settings'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A server is optional: it lets you keep stories across devices and work with others.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use what is a keres server? when you need to adapt the app to how you work.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open the matching screen from the menu.',
        'Fill in or choose available options.',
        'Save or confirm the change when the screen asks.',
        'Return to the menu to use the updated feature.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The change applies to the selected feature and can appear in related forms, searches, collaboration, or synchronization.',
    },
    { type: 'seeAlso', pages: ['story-settings', 'sync-basics', 'friends'] },
  ],
};
export default page;
