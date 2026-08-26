import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'dramatic-irony',
  title: 'Dramatic irony',
  summary: 'The audience knows something a character does not, and waits.',
  keywords: [
    'dramatic irony',
    'ironia dramatica',
    'suspense',
    'hitchcock',
    'knowledge gap',
    'tension',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A deliberate gap between what the audience knows and what a character knows. The tension comes from anticipation rather than surprise: every ordinary line the character says acquires a second meaning, and the audience carries the weight of the information.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'You want sustained dread across a long scene instead of a single jolt.',
        'A quiet conversation must feel dangerous.',
        'Tragedy, where the audience should see the error before the character.',
        'Comedy built on mistaken assumptions.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'We watched him hide the letter. Now his sister asks, casually, whether anything came in the post, and every word of his answer is a small avalanche.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Revealing to the audience too early, so the wait outlasts the interest.',
        'Letting the uninformed character behave stupidly to keep the gap open.',
        'Never closing the gap; the payoff is the moment the character learns.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['foreshadowing', 'subtext', 'ticking-clock', 'unreliable-narrator'],
    },
  ],
};
export default page;
