import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'subtext',
  title: 'Subtext',
  summary: 'What is meant under what is said. Usually the real content of a scene.',
  keywords: ['subtext', 'subtexto', 'dialogue', 'implication', 'unsaid', 'tension'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The gap between the surface of a line and its intent. Characters argue about the dishes and mean the marriage. Subtext exists whenever a character has a reason not to say the thing directly, and it gives the audience the pleasure of understanding without being told.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Two characters want incompatible things and both know it.',
        'The scene is on-the-nose and every line states its own purpose.',
        'A relationship has history the audience should infer, not receive.',
        'Grief, desire, or shame is present, since those rarely announce themselves.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'He asks whether she has eaten. She says she is not hungry. He asks again on the way out. Neither of them mentions the letter on the table.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Subtext so deep nothing surfaces, leaving a scene about nothing.',
        'A character explaining the subtext, which deletes it.',
        'Using it where directness would be stronger; sometimes people say the thing.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['dialogue-beats', 'show-dont-tell', 'iceberg-theory', 'dramatic-irony'],
    },
  ],
};
export default page;
