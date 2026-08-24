import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'save-the-cat-beat-sheet',
  title: 'Beat sheet',
  summary: 'A fifteen-beat commercial template with fixed proportions.',
  keywords: [
    'beat sheet',
    'save the cat',
    'snyder',
    'beats',
    'all is lost',
    'dark night of the soul',
    'folha de batidas',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A screenwriting template that names fifteen beats and roughly where they fall: opening image, theme stated, setup, catalyst, debate, break into two, B story, fun and games, midpoint, bad guys close in, all is lost, dark night of the soul, break into three, finale, final image. Its value is diagnostic, not generative.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A draft feels shapeless and you want to see which beat is missing or misplaced.',
        'You are writing in a commercial genre whose audience knows this rhythm.',
        'You want the theme spoken aloud early so the ending can answer it.',
        'You need to compare your structure against a common reference with collaborators.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'You notice your all-is-lost beat arrives at the very end, leaving no room for the dark night. Moving it earlier gives the character time to decide rather than merely survive.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Writing to the percentages and producing a competent, forgettable work.',
        'Confusing the beat sheet with the story; it describes shape, not meaning.',
        'Using it for forms it was never meant for, such as short fiction or slow literary work.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['three-act-structure', 'seven-point-structure', 'save-the-cat', 'theme-statement'],
    },
  ],
};
export default page;
