import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'see-also',
  title: 'See also',
  summary: 'Create a free, mutual link between related elements.',
  keywords: ['see also', 'story'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'See also connects two elements when a tag is too short and a note is not the right relationship.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'Use see also to make a narrative decision clear before reviewing the next scene.',
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
