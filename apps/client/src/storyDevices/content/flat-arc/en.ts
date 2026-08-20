import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'flat-arc',
  title: 'Flat arc',
  summary: 'The character does not change; the world around them does.',
  keywords: ['flat arc', 'static character', 'arco plano', 'testing arc', 'catalyst', 'conviction'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A protagonist who already holds the truth of the story and whose conviction is tested rather than corrected. The pressure comes from a world that punishes that conviction, and the change happens in the people around them.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Series and episodic work, where the lead must remain recognisable.',
        'The theme is about integrity under pressure rather than about growth.',
        'You want the supporting cast to carry the transformation.',
        'Mystery and procedural forms, where competence is part of the pleasure.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The teacher never stops believing the students can pass. She is worn down, defunded, and doubted, and by the end it is the school that has moved, not her.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Confusing a flat arc with a character who has no interior life.',
        'Never testing the conviction, which turns it into a slogan.',
        'Leaving the world unchanged too, so nothing at all happened.',
      ],
    },
    { type: 'seeAlso', pages: ['character-arc', 'the-foil', 'thematic-mirror', 'want-vs-need'] },
  ],
};
export default page;
