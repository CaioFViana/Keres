import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'sensory-grounding',
  title: 'Sensory grounding',
  summary: 'Anchor a scene with specific physical detail, especially the senses we forget.',
  keywords: [
    'sensory grounding',
    'ancoragem sensorial',
    'five senses',
    'smell',
    'texture',
    'immersion',
    'detail',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Placing the audience inside a moment through concrete sensation. Sight and sound arrive by default; smell, temperature, texture, and taste are what convince, because they are the details a summary never carries.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A scene feels like it is happening on a blank stage.',
        'Emotion needs a body: fear, grief, and desire are physical before they are verbal.',
        'You are establishing a place the work will return to.',
        'A long stretch of dialogue has lost its location.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The waiting room is not tense: it smells of instant coffee and floor cleaner, and the chair is still warm from whoever left before her.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Cataloguing all five senses on schedule, which reads as an exercise.',
        'Choosing generic detail; the specific one does the work.',
        'Grounding scenes that should be moving fast, and killing their speed.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['show-dont-tell', 'iceberg-theory', 'pacing', 'motif-and-leitmotif'],
    },
  ],
};
export default page;
