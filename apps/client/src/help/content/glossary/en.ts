import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'glossary',
  title: 'Glossary',
  summary: 'Look up terms that appear in the interface.',
  keywords: ['glossary', 'help'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The glossary summarizes words such as scene, chapter, choice, marker, tag, and collaborator.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Consult glossary when this part of your work needs a decision or review.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open the matching screen from the menu.',
        'Read the information or choose the needed action.',
        'Confirm the change when the screen asks.',
        'Return to the story or list to check the result.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The result can appear in collaboration, synchronization, lists, or related details according to the action taken.',
    },
    { type: 'seeAlso', pages: ['using-this-help', 'sync-basics', 'data-and-backup'] },
  ],
};
export default page;
