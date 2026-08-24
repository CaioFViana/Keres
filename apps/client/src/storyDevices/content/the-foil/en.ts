import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'the-foil',
  title: 'The foil',
  summary: 'A character built to contrast, making the protagonist legible.',
  keywords: ['foil', 'contraste', 'sombra do heroi', 'contrast', 'sidekick', 'rival'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A character whose traits are arranged to throw the protagonist into relief: same situation, opposite instinct. A good foil is not an opposite in everything — the closer they are in circumstance, the sharper the one difference cuts.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The protagonist is hard to characterise because nothing measures them.',
        'You want to argue a theme through two people instead of narration.',
        'A partnership, rivalry, or sibling pair is at the centre of the work.',
        'The antagonist needs to be more than an obstacle.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Two doctors from the same class, same hospital, same ambition. One writes everything down; one remembers everything. The story is about which habit survives an error.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Building a foil with no life outside the comparison.',
        'Contrasting on so many axes that the meaningful difference is lost.',
        'Letting the foil always be wrong, which turns contrast into a lecture.',
      ],
    },
    { type: 'seeAlso', pages: ['thematic-mirror', 'flat-arc', 'role-reversal', 'character-arc'] },
  ],
};
export default page;
