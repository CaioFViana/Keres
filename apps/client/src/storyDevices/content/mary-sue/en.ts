import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'mary-sue',
  title: 'Mary Sue',
  summary: 'The flawless character with nothing to learn, and therefore nothing to watch.',
  keywords: [
    'mary sue',
    'gary stu',
    'flawless',
    'wish fulfilment',
    'personagem perfeito',
    'competence',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A shorthand for a character who is uniformly competent, universally admired, never seriously wrong, and never made to pay. It removes dramatic tension because outcomes stop being in doubt and choices stop costing anything.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'As a diagnostic while revising: ask where this character was wrong and what it cost.',
        'When you notice other characters exist mainly to admire someone.',
        'When power creep has outpaced consequence in a long series.',
        'Deliberately, in power-fantasy forms whose audience wants exactly that.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The fix is rarely to weaken the character. Give the same competence a price: she is right about the diagnosis and wrong about the family, and the second error is the one that stays.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Adding a cosmetic flaw such as clumsiness that costs nothing.',
        'Using the label to dismiss competent characters, especially women, rather than to diagnose a structural problem.',
        'Solving it by humiliating the character instead of by giving them stakes.',
      ],
    },
    { type: 'seeAlso', pages: ['character-arc', 'the-wound', 'want-vs-need', 'the-foil'] },
  ],
};
export default page;
