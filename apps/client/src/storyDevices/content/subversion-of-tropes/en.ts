import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'subversion-of-tropes',
  title: 'Subversion of tropes',
  summary: 'Invoke a familiar convention, then change what it does.',
  keywords: [
    'subversion',
    'trope',
    'quebra de expectativa',
    'expectation',
    'genre',
    'deconstruction',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Setting up a pattern the audience recognises and then delivering something else. It works only if the convention is genuinely established first, because the meaning is created by the difference between what was promised and what arrived.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The genre is well known and straight delivery would be inert.',
        'You want to say something about the convention itself.',
        'A character type deserves to be treated as a person instead.',
        'A beat is predictable and predictability is costing you attention.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The mentor gives the speech, the music swells, and the student says it is a terrible plan and walks out. The scene works because we knew the shape it was breaking.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Subverting for its own sake, which leaves a gap where meaning should be.',
        'Cynicism mistaken for insight; refusing the convention is not the same as answering it.',
        'Subverting a convention the audience does not actually hold.',
      ],
    },
    { type: 'seeAlso', pages: ['lampshading', 'role-reversal', 'red-herring', 'rule-of-three'] },
  ],
};
export default page;
