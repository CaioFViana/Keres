import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'pacing',
  title: 'Pacing',
  summary: 'Control the speed of reading through sentence, paragraph, and scene length.',
  keywords: ['pacing', 'ritmo', 'rhythm', 'sentence length', 'tension', 'summary', 'speed'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The audience reads at the speed the prose allows. Short sentences and paragraphs accelerate; long ones with subordinate clauses slow down and invite reflection. Scene length, white space, and how much is summarised versus dramatised do the same work at a larger scale.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Action reads as flat because the sentences are the same length as the reflection.',
        'A reflective passage feels rushed and unearned.',
        'The middle of a work drags and you cannot find a plot cause.',
        'You need a moment to land, and slowing down is the whole technique.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'He ran. The door was shut. Behind him, someone laughed. Then, later, three lines that unwind for half a page while he waits for his own breathing to slow.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Fast pacing everywhere, which flattens the peaks it was meant to create.',
        'Confusing pace with event count; a slow scene can be tense.',
        'Summarising the moments the audience came for and dramatising the ones they did not.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['scene-and-sequel', 'in-late-out-early', 'ticking-clock', 'rule-of-three'],
    },
  ],
};
export default page;
