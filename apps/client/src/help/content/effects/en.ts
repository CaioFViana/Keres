import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'effects',
  title: 'Scene or choice effects',
  summary: 'Record changes that happen after a scene or decision.',
  keywords: ['scene or choice effects', 'story'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Effects can give or remove items and turn markers on or off. They help analysis understand story paths.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use scene or choice effects to make a narrative decision clear before reviewing the next scene.',
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
