import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'lampshading',
  title: 'Lampshading',
  summary: 'Have a character name the implausibility so the audience stops arguing with it.',
  keywords: ['lampshading', 'coincidence', 'genre awareness', 'acknowledgement', 'plausibility'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Acknowledging a coincidence, a convention, or an absurdity out loud, through a character, so the audience knows the work saw it too. It buys goodwill by trading a suspension of disbelief for a shared joke or a shared unease.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A necessary coincidence would otherwise stop the audience cold.',
        'You are using a convention knowingly and want that known.',
        'Comedy, where naming the machinery is itself the pleasure.',
        'A genre-literate audience will spot the move regardless.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Someone says, out loud, that of all the hospitals in the city they ended up in this one, and moves on. The coincidence stays; the objection is spent.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Using it to excuse a real structural problem instead of fixing it.',
        'Naming everything, until the work is commentary on a story rather than a story.',
        'Breaking a carefully built tone for a joke that costs more than it earns.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['deus-ex-machina', 'subversion-of-tropes', 'frame-story', 'red-herring'],
    },
  ],
};
export default page;
