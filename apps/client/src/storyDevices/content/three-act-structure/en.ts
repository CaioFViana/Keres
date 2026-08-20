import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'three-act-structure',
  title: 'Three-act structure',
  summary: 'Setup, confrontation, resolution — the default shape most audiences already expect.',
  keywords: [
    'three act',
    'structure',
    'setup',
    'confrontation',
    'resolution',
    'estrutura de tres atos',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The work splits into three movements: Act 1 establishes who wants what and why it is hard, Act 2 escalates the obstacles until the situation is worse than at the start, and Act 3 forces a decision and lives with its consequences. The two act breaks are the moments the protagonist can no longer go back.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'You have scenes and no spine, and need somewhere to hang them.',
        'The middle of the draft sags and you cannot tell where it started sagging.',
        'You work in a medium with a fixed running time and need proportions.',
        'You want a structure the audience reads without noticing it.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'A cook discovers the restaurant is laundering money (end of Act 1: she cannot unknow it). She tries to expose it quietly and every attempt costs her more (Act 2). She chooses between her job and her testimony (Act 3).',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Treating the act breaks as page counts rather than as points of no return.',
        'Letting Act 2 become a corridor of events that could be reordered without loss.',
        'Resolving Act 3 with information the audience never had.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['freytags-pyramid', 'seven-point-structure', 'save-the-cat-beat-sheet', 'pacing'],
    },
  ],
};
export default page;
