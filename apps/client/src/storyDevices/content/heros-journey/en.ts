import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'heros-journey',
  title: 'Hero journey',
  summary: 'The protagonist leaves the ordinary world, is tested, and returns changed.',
  keywords: [
    'heros journey',
    'monomyth',
    'campbell',
    'vogler',
    'jornada do heroi',
    'mentor',
    'threshold',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A cycle described from comparative mythology and later turned into a screenwriting template: call to adventure, refusal, mentor, crossing the threshold, trials and allies, ordeal, reward, road back, and return carrying something the old world needed.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The story is fundamentally about transformation through displacement.',
        'You want a recognisable mythic register: fantasy, adventure, coming of age.',
        'You need a checklist to find which beat your draft is missing.',
        'You are deliberately subverting it and need to know what you are subverting.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'A courier refuses a delivery that would take her past the border, loses her livelihood anyway, takes the job, and comes home with a map that makes her old employer obsolete.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Filling every stage because the template lists it, producing scenes with no pressure behind them.',
        'Assuming it is universal; many traditions structure stories without departure and return at all.',
        'Making the mentor a delivery mechanism for exposition instead of a character with a stake.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['story-circle', 'refusal-of-the-call', 'heroines-journey', 'kill-the-mentor'],
    },
  ],
};
export default page;
