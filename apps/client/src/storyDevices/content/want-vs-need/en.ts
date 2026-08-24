import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'want-vs-need',
  title: 'Want versus need',
  summary: 'The conscious goal against the unconscious lesson. The engine of internal conflict.',
  keywords: ['want vs need', 'desejo e necessidade', 'internal conflict', 'goal', 'lie', 'arc'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The want is what the character is chasing and can state out loud. The need is what would actually make them whole, and they usually cannot see it. Plot is built from the want; meaning is built from the collision between the two.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A protagonist is active but the story feels weightless.',
        'You are designing an ending and cannot decide whether they should win.',
        'A character keeps making decisions the audience finds inexplicable.',
        'Every subplot needs a reason to exist beyond filling time.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'He wants the promotion that proves his father wrong. He needs to stop arguing with a man who has been dead for nine years. The story can give him one, both, or neither, and each combination means something different.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Stating the need aloud early, which converts it into another want.',
        'Making want and need identical, which removes the internal conflict entirely.',
        'Granting the need without the character choosing it.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['character-arc', 'the-wound', 'theme-statement', 'impossible-choice'],
    },
  ],
};
export default page;
