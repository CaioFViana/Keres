import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'show-dont-tell',
  title: 'Show, do not tell',
  summary: 'Let behaviour and detail carry what a summary would flatten.',
  keywords: [
    'show dont tell',
    'mostre nao conte',
    'concrete detail',
    'behaviour',
    'summary',
    'evidence',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Instead of naming a state — she was nervous, the town was poor — give the audience the evidence and let them do the naming. The conclusion the audience reaches themselves is held more firmly than the one they are handed.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'A moment is important and the audience must feel it, not file it.',
        'The emotion is complicated enough that any single word would reduce it.',
        'You are writing a first impression of a person or place.',
        'A draft is full of adjectives and short of specifics.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Not she was nervous, but she read the same line of the menu four times and then ordered something not on it.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Applying it everywhere, which bloats routine transitions into set pieces.',
        'Showing and then telling anyway, in case the audience missed it.',
        'Forgetting that summary is a legitimate tool for anything that should pass quickly.',
      ],
    },
    { type: 'seeAlso', pages: ['sensory-grounding', 'subtext', 'iceberg-theory', 'pacing'] },
  ],
};
export default page;
