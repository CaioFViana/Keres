import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'setup-and-payoff',
  title: 'Setup and payoff',
  summary: 'Plant something early so a later moment lands without explanation.',
  keywords: ['setup and payoff', 'plant', 'callback', 'plantio e colheita', 'pagamento', 'echo'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A pair: a piece of information, object, skill, or phrase introduced casually, and a later moment that depends on it. The payoff feels earned because the audience already holds the piece and recognises it at speed, which is why it reads as satisfaction rather than as a rule being explained.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A climax requires knowledge the audience does not yet have.',
        'You want an emotional beat to land in one line rather than a paragraph.',
        'A comedic or tragic reversal needs a shared reference.',
        'You are revising and the ending feels asserted rather than delivered.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'In chapter two she teaches her brother to whistle badly. In chapter nineteen, in the dark, a bad whistle tells her he is alive.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Setting up and forgetting to pay off, leaving a loose promise.',
        'Paying off without setup, which is the same as asking the audience to accept a coincidence.',
        'Spacing them so far apart that the audience no longer remembers the plant.',
      ],
    },
    { type: 'seeAlso', pages: ['chekhovs-gun', 'foreshadowing', 'bookending', 'rule-of-three'] },
  ],
};
export default page;
