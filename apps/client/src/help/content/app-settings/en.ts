import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'app-settings',
  title: 'App settings',
  summary: 'Adjust appearance, language, and your local name.',
  keywords: ['app settings', 'settings'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Settings control light or dark theme, language, and local username; they are not story settings.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use app settings when you need to adapt the app to how you work.',
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
