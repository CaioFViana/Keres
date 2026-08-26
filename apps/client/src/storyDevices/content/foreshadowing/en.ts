import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'foreshadowing',
  title: 'Foreshadowing',
  summary: 'Quiet signals early that make a later turn feel inevitable in hindsight.',
  keywords: ['foreshadowing', 'pressagio', 'presságio', 'hint', 'clue', 'omen', 'inevitability'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Clues, images, or lines placed so the audience registers them without deciding they matter. The goal is not that they guess, but that after the turn they can retrace the path and find it was always there.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A twist would otherwise feel arbitrary.',
        'You need dread rather than surprise, so the audience feels it coming.',
        'A character decision late in the work must seem consistent.',
        'You are revising and want to seed a reveal you invented after the fact.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Three chapters before the flood, a minor character complains that the pumps have not been serviced since the merger. Nobody follows up.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Foreshadowing so loudly it becomes an announcement.',
        'Confusing it with a red herring: this one must be true.',
        'Relying on it to excuse a twist that violates what the story established.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['chekhovs-gun', 'dramatic-irony', 'red-herring', 'setup-and-payoff'],
    },
  ],
};
export default page;
