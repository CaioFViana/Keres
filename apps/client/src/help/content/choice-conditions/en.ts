import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'choice-conditions',
  title: 'Conditions for a choice',
  summary: 'Define when a choice is shown to a reader.',
  keywords: ['conditions for a choice', 'story'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Conditions check visits, items, and markers before a choice appears. Groups use all conditions or any condition.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use conditions for a choice to make a narrative decision clear before reviewing the next scene.',
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
