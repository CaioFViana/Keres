import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'fichtean-curve',
  title: 'Fichtean curve',
  summary: 'Almost no setup: a rising staircase of crises straight to the climax.',
  keywords: [
    'fichtean curve',
    'crisis',
    'rising action',
    'curva fichteana',
    'thriller',
    'escalation',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A shape made almost entirely of rising action. The work opens close to trouble and stacks a series of crises, each one raising the stakes and revealing backstory in passing, until the final crisis becomes the climax. Exposition is delivered inside conflict rather than before it.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Thrillers, horror, and any work where a slow opening loses the audience.',
        'Serialised release, where every instalment must end on pressure.',
        'The backstory is rich but stops the story dead when told up front.',
        'You want tension to be the default state rather than a visitor.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'A night pharmacist is robbed on page one. Who she used to be, and why she does not call the police, arrives in fragments across the next five crises.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Escalating volume instead of stakes, so crisis five feels like crisis one, louder.',
        'Never letting the audience breathe, which flattens the climax.',
        'Withholding so much context that the crises stop meaning anything.',
      ],
    },
    { type: 'seeAlso', pages: ['in-media-res', 'pacing', 'ticking-clock', 'cliffhanger'] },
  ],
};
export default page;
