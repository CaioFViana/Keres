import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'impossible-choice',
  title: 'Impossible choice',
  summary: 'Two options, both bad, and no third door.',
  keywords: [
    'impossible choice',
    'dilemma',
    'dilema',
    'mortons fork',
    'escolha impossivel',
    'sacrifice',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A dilemma engineered so that every available path costs the character something they value. Because refusing is also a choice, it exposes priorities the character would never state aloud. It is the most direct instrument for revealing values under pressure.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'You need to show, not assert, what a character actually believes.',
        'The climax should turn on a decision rather than on a fight.',
        'Two sympathetic goods are in genuine conflict.',
        'In branching work, where each option must be defensible to a real audience.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'She can name her colleague and keep the clinic open, or stay silent and watch it close. Both outcomes are the ending; the story is which one she can live with.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Weighting one option so heavily that there is no dilemma, only a delay.',
        'Letting a third option appear from outside and rescue the character.',
        'Skipping the aftermath; the choice means little if nobody pays for it on the page.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['hobsons-choice', 'want-vs-need', 'ticking-clock', 'role-reversal'],
    },
  ],
};
export default page;
