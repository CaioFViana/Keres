import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'motif-and-leitmotif',
  title: 'Motif and leitmotif',
  summary: 'A repeated image, phrase, or sound that accumulates meaning.',
  keywords: ['motif', 'leitmotif', 'motivo', 'leitmotiv', 'repetition', 'symbol', 'recurrence'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'An element that recurs across the work and gains weight each time. A motif is a repeated image or idea; a leitmotif is tied to a specific character, place, or idea and announces it. Meaning comes from context changing while the element stays the same.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A theme needs a physical form the audience can recognise.',
        'You want an ending to resonate without restating anything.',
        'Long or fragmented works that need connective tissue.',
        'Multi-sensory media, where a sound or colour can do the work silently.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Hands appear whenever trust is at stake: a handshake refused, a splinter pulled out, and at the end, a hand held out and not taken.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Repetition without variation, which is noticed as a tic rather than felt.',
        'Explaining the motif once, which converts it into a label.',
        'Choosing something so generic — rain, mirrors — that it carries nothing specific.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['thematic-mirror', 'bookending', 'theme-statement', 'rule-of-three'],
    },
  ],
};
export default page;
