import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'dialogue-beats',
  title: 'Dialogue beats',
  summary: 'Action and silence between lines, doing what the lines cannot.',
  keywords: [
    'dialogue beats',
    'beats de dialogo',
    'action beat',
    'pause',
    'blocking',
    'attribution',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The small physical actions, pauses, and interruptions placed between spoken lines: someone stands up, refills a glass, does not answer. Beats control the rhythm of a conversation, replace adverbs in attribution, and let the audience read intention from behaviour.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A conversation reads as disembodied voices in a void.',
        'You need a pause to carry weight that no line could carry.',
        'Attribution has become a list of adverbs: he said angrily, she said softly.',
        'The scene needs to remind the audience where it is happening.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Instead of "I forgive you," she said coldly, try: she closed the laptop. "I forgive you." She did not look up.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Filler beats — nodding, smiling, sipping — that add words and no meaning.',
        'A beat after every line, which turns dialogue into stage directions.',
        'Beats that contradict the line by accident rather than on purpose.',
      ],
    },
    { type: 'seeAlso', pages: ['subtext', 'show-dont-tell', 'pacing', 'sensory-grounding'] },
  ],
};
export default page;
