import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'iceberg-theory',
  title: 'Iceberg theory',
  summary: 'Leave most of what you know out, and the omission will still be felt.',
  keywords: [
    'iceberg theory',
    'teoria do iceberg',
    'omission',
    'hemingway',
    'restraint',
    'implication',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The claim that a work gains weight when the author knows far more than is on the page and deliberately omits it. Omission only works when the knowledge exists: the audience senses the shape of what is missing. Invented absence reads as vagueness instead.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Backstory is threatening to become an essay.',
        'You want the audience leaning in rather than being briefed.',
        'Short forms, where every sentence must carry more than its surface.',
        'Grief and trauma, where the direct account often diminishes the subject.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'You have written a two-page history of the brothers. Keep one sentence: he still sets the table for four. Everything else stays in your notes.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Omitting what you never worked out, which the audience feels as a hole.',
        'Withholding basic clarity, which is confusion, not restraint.',
        'Treating it as licence to skip the difficult scene rather than to compress it.',
      ],
    },
    { type: 'seeAlso', pages: ['show-dont-tell', 'subtext', 'the-wound', 'sensory-grounding'] },
  ],
};
export default page;
