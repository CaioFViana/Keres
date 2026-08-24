import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'chekhovs-gun',
  title: 'Chekhov gun',
  summary: 'What you deliberately show must matter later, or should not be shown.',
  keywords: ['chekhovs gun', 'economy', 'arma de tchekhov', 'setup', 'promise', 'detail'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A principle of narrative economy: an element the work stops to point at reads as a promise. Emphasis, not mere presence, creates the debt. A rifle described in the first scene should be fired; if it will not be, describe something else.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Editing a draft that is full of vivid details doing no work.',
        'Planting the tool, wound, or fact a later scene will need.',
        'You want the ending to feel inevitable rather than convenient.',
        'The audience is guessing wrong because you emphasised the wrong things.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'If a chapter lingers on the broken lock, the broken lock should matter. If nobody will ever use it, mention the door and move on.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Reading it as a ban on texture; worlds need details that are only texture.',
        'Firing the gun so promptly that the audience feels the machinery.',
        'Planting so obviously that the setup announces the payoff.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['setup-and-payoff', 'foreshadowing', 'red-herring', 'deus-ex-machina'],
    },
  ],
};
export default page;
