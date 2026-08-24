import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'story-analysis',
  title: 'Story analysis',
  summary: 'Find narrative links that may need review.',
  keywords: ['analysis', 'isolated scene', 'broken choice', 'warning', 'reachability', 'progress'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Analysis checks story structure and shows warnings about relationships that look incomplete or contradictory. A quick set of checks appears as soon as you open the screen; a deeper check, covering whether every scene and choice can actually be reached, only runs when you ask for it.',
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
        'Open analysis. The quick warnings load right away.',
        'For a branching story, tap Check reachability & choice logic to also look for scenes and choices that can never actually be reached.',
        'Wait for the progress bar to finish, or tap Cancel to stop it.',
        'Read each warning and open the indicated element.',
        'Correct the link, scene, choice, or field when the observation makes sense.',
        'Run the check again to confirm the result.',
      ],
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'The deeper check can take a while on a large branching story, so it does not run on its own - press the button whenever you want an up-to-date result. Only one can run at a time, and leaving the screen stops it.',
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
