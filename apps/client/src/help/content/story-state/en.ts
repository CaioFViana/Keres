import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-state',
  title: 'Inventory and markers',
  summary: 'Track what the reader carries and what has happened.',
  keywords: ['inventory and markers', 'story'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Reader state gathers inventory and markers. Effects write this state and conditions read it.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use inventory and markers to make a narrative decision clear before reviewing the next scene.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open the matching element in the Story menu.',
        'Create or edit the record you want.',
        'Fill in options that describe your decision and save.',
        'Return to details to check links.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The feature is used by scenes, choices, analysis, or related details according to the link you created.',
    },
    { type: 'seeAlso', pages: ['choices', 'scenes', 'story-analysis'] },
  ],
};
export default page;
