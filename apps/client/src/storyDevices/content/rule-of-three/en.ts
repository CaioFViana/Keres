import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'rule-of-three',
  title: 'Rule of three',
  summary: 'Three is the smallest number that establishes a pattern and lets you break it.',
  keywords: ['rule of three', 'regra dos tres', 'pattern', 'comedy', 'triad', 'rhythm'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Grouping in threes: two instances create an expectation, the third confirms or subverts it. It underlies comic timing, escalating tests, and the shape of many lists and speeches, because it is the shortest sequence that feels complete.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A joke needs a structure: setup, reinforcement, break.',
        'A trial or attempt should escalate and end without feeling arbitrary.',
        'A sentence or list needs a rhythm the audience finishes with you.',
        'You want a motif to be recognised without being explained.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'She apologises to her editor. She apologises to the intern. She starts to apologise to the man who cut her off in traffic, and stops mid-sentence.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Using threes everywhere until the rhythm becomes a metronome.',
        'Making all three beats equal, so the third has nothing to add.',
        'Applying it to material where the honest count is two or five.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['pacing', 'setup-and-payoff', 'motif-and-leitmotif', 'subversion-of-tropes'],
    },
  ],
};
export default page;
