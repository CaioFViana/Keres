import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'kishotenketsu',
  title: 'Kishotenketsu',
  summary: 'Four movements that build meaning through juxtaposition rather than conflict.',
  keywords: [
    'kishotenketsu',
    'four act',
    'twist',
    'east asian',
    'no conflict',
    'quatro atos',
    'ki sho ten ketsu',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A traditional East Asian four-part shape: introduction (ki), development (sho), a turn that is not caused by what came before (ten), and a conclusion that reconciles the two (ketsu). The turn is a change of view, not an escalation, and the work does not need an antagonist.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A quiet, contemplative, or slice-of-life piece where conflict would feel imposed.',
        'Short forms: a comic strip, a vignette, a single chapter.',
        'You want the audience to do the synthesis instead of receiving it.',
        'You want to break out of a conflict-first habit and see what remains.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'A man waters plants on his balcony (ki). A neighbour starts leaving him seedlings (sho). Elsewhere in the city, a greenhouse is demolished (ten). The last panel shows the balcony crowded with plants that had nowhere else to go (ketsu).',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Making the turn a plot twist, which converts it back into conflict.',
        'Explaining the connection in the fourth movement and killing the synthesis.',
        'Assuming no conflict means no tension; the tension is in the gap between parts.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['three-act-structure', 'thematic-mirror', 'subtext', 'motif-and-leitmotif'],
    },
  ],
};
export default page;
