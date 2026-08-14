import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-map',
  title: 'Story map',
  summary: 'See scenes and paths in a branching story.',
  keywords: ['story map', 'story'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    { type: 'paragraph', text: 'The map draws scenes and the choices connecting them.' },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use story map to organize the narrative and check links before writing or revising.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open the matching item in the Story menu.',
        'Create or select the record you want to work on.',
        'Fill in needed information and save.',
        'Return to the list or map to review the result.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Information is available in related details and tools in the same story. Review links before deleting something another screen might use.',
    },
    { type: 'seeAlso', pages: ['scenes', 'story-analysis', 'lists-and-search'] },
  ],
};
export default page;
