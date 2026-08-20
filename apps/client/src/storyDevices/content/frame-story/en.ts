import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'frame-story',
  title: 'Frame story',
  summary: 'A story told inside another story, which colours how we read it.',
  keywords: [
    'frame story',
    'frame narrative',
    'narrativa emoldurada',
    'nested',
    'storyteller',
    'epistolary',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'An outer situation, often someone telling or reading, contains the main narrative. The frame supplies a teller with motives, an audience with reactions, and a distance the work can exploit: we are always aware someone chose to tell it this way.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Who is telling the story matters as much as the story.',
        'You want built-in permission for gaps, summary, and unreliable detail.',
        'The material spans wildly different times, places, or registers.',
        'You want an ending that lands in the frame rather than in the tale.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'A retired firefighter recounts one night to an insurance investigator. Everything we see is her version, and the last scene returns to the investigator deciding whether to write it down.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Opening the frame and forgetting to close it, which reads as an abandoned promise.',
        'A frame that adds nothing except delay before the real story.',
        'Nesting so many layers that the audience stops tracking who is speaking.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['unreliable-narrator', 'bookending', 'point-of-view', 'in-media-res'],
    },
  ],
};
export default page;
