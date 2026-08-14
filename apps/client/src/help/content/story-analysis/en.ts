import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-analysis',
  title: 'Story analysis',
  summary: 'Find narrative links that may need review.',
  keywords: ['analysis', 'isolated scene', 'broken choice', 'warning'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Analysis checks story structure and shows warnings about relationships that look incomplete or contradictory.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'If a choice leads to a removed scene, analysis points to that choice so you can choose another destination or delete it.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['Story menu', 'Story analysis'] },
    {
      type: 'steps',
      items: [
        'Open analysis.',
        'Read each warning and open the indicated element.',
        'Correct the link, scene, choice, or field when the observation makes sense.',
        'Return to analysis to check the result.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'A warning changes nothing on its own. Correcting an element updates scenes, choices, maps, and searches that use it.',
    },
    { type: 'seeAlso', pages: ['scenes', 'choices', 'story-map', 'story-type'] },
  ],
};
export default page;
