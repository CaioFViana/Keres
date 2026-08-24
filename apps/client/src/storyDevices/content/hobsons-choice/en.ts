import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'hobsons-choice',
  title: 'Illusion of choice',
  summary: 'Options are offered, but only one is viable.',
  keywords: [
    'hobsons choice',
    'illusion of choice',
    'ilusao de escolha',
    'false choice',
    'branching',
    'agency',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A situation presented as a decision where refusal is not survivable and the alternatives are decorative. Used deliberately, it dramatises powerlessness; used carelessly, it makes the audience feel their attention was wasted.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The theme is coercion, poverty, bureaucracy, or captivity.',
        'You want a character to be seen accepting something they did not choose.',
        'In branching work, when narrowing back to a single line is unavoidable.',
        'You want the audience to notice that the choice was never real.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The contract offers three payment plans. She has to sign today, and all three end with the same house belonging to someone else.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Presenting it as a genuine dilemma, which cheats the audience.',
        'In interactive work, offering options with identical outcomes and no acknowledgement.',
        'Using it so often that the audience stops believing any choice matters.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['impossible-choice', 'ticking-clock', 'theme-statement', 'subversion-of-tropes'],
    },
  ],
};
export default page;
