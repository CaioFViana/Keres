import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'story-circle',
  title: 'Story circle',
  summary: 'Eight steps: you, need, go, search, find, take, return, change.',
  keywords: ['story circle', 'harmon', 'eight steps', 'roda da historia', 'cycle'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A compressed, repeatable version of the departure-and-return cycle, popularised for episodic television. A character in comfort feels a need, enters an unfamiliar situation, adapts to it, gets what they wanted, pays for it, returns, and is measurably different.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'You need a shape for one episode, chapter, or side quest rather than a whole work.',
        'The main plot already has structure and a subplot does not.',
        'You want the change to be visible in a single sitting.',
        'You are drafting fast and want eight prompts instead of a theory.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'A nurse who never asks for help (you) needs a night off (need), swaps shifts (go), covers a ward she does not know (search), handles it (find), misses her sister on the phone (take), returns to her own ward (return), and starts asking (change).',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Reaching change without ever showing the price paid at take.',
        'Closing the circle so tightly that nothing outside the protagonist matters.',
        'Repeating the same circle every episode until the audience predicts the beat instead of the outcome.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['heros-journey', 'character-arc', 'want-vs-need', 'scene-and-sequel'],
    },
  ],
};
export default page;
