import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'the-wound',
  title: 'The wound',
  summary: 'A past injury that explains the present defence.',
  keywords: ['the wound', 'ghost', 'backstory', 'ferida', 'chaga', 'trauma', 'flaw'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A specific event before the story that taught the character a false lesson. The lesson, not the event, is what drives behaviour now: it produces the defence, the blind spot, and the reason they will refuse the very thing they need.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A flaw feels arbitrary and you need it to feel earned.',
        'You must justify a refusal, a phobia, or a pattern of self-sabotage.',
        'The ending requires the character to risk exactly what once hurt them.',
        'You are building a relationship where two wounds aggravate each other.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'She was left waiting outside a school for six hours at nine years old. She is never late, never depends on anyone, and cannot forgive lateness in others. The story never has to say why in full.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Explaining the wound in a single flashback that solves the mystery of the character.',
        'Making it so extreme that it becomes the whole personality.',
        'Healing it through insight alone rather than through action taken at risk.',
      ],
    },
    { type: 'seeAlso', pages: ['want-vs-need', 'character-arc', 'flat-arc', 'iceberg-theory'] },
  ],
};
export default page;
