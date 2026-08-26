import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'role-reversal',
  title: 'Role reversal',
  summary: 'The hunter becomes the hunted; the protector becomes the protected.',
  keywords: ['role reversal', 'inversao de papeis', 'reversal', 'power shift', 'turn', 'mentor'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A structural swap in which two characters exchange positions of power, knowledge, or dependence. It works because the audience has already learned the original arrangement, so the reversal reads instantly and forces both characters to improvise.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A relationship has been stable long enough that the audience takes it for granted.',
        'You want a midpoint that changes the terms rather than the location.',
        'The student must surpass the teacher, or the pursuer must be exposed.',
        'You need a scene to reveal what a character is like without their usual advantage.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'For twelve chapters the detective interviews her. In chapter thirteen she has the file and he answers the questions, in the same room, in the same chairs.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Reversing without establishing the original arrangement clearly enough to feel it.',
        'Swapping positions but not behaviour, so nothing is actually revealed.',
        'Reversing repeatedly until power reads as arbitrary.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['kill-the-mentor', 'the-foil', 'impossible-choice', 'subversion-of-tropes'],
    },
  ],
};
export default page;
