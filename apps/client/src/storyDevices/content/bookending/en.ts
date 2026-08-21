import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'bookending',
  title: 'Bookending',
  summary: 'End where you began, so the difference is the point.',
  keywords: ['bookending', 'circular', 'opening image', 'final image', 'echo', 'symmetry'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Repeating the opening situation, image, or line at the close. Because the surroundings are identical, everything that changed becomes measurable: the same kitchen, the same question, a different answer.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A character arc needs proof rather than assertion.',
        'The work is about return, cycles, or inheritance.',
        'You want an ending that feels composed rather than stopped.',
        'The opening image is strong and has more to give.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'It opens with her waiting for a call she will not take. It ends with the same phone, the same room, and her answering on the first ring.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Repeating without change, which reads as an author trick rather than an ending.',
        'Making the echo so literal that it announces itself.',
        'Bookending a work whose meaning depends on leaving the starting point behind.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['motif-and-leitmotif', 'character-arc', 'chapter-hook', 'frame-story'],
    },
  ],
};
export default page;
