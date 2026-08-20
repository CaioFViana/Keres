import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'unreliable-narrator',
  title: 'Unreliable narrator',
  summary: 'A narrator the audience learns to read against.',
  keywords: [
    'unreliable narrator',
    'narrador nao confiavel',
    'bias',
    'self deception',
    'twist',
    'testimony',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A narrating voice whose account cannot be taken at face value, through self-deception, limited understanding, or deliberate lying. The work must give the audience enough evidence to see past the narration without ever stepping outside it.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The subject is denial, memory, guilt, or justification.',
        'You want the audience to do detective work on the telling itself.',
        'A character explaining themselves is more revealing than the events.',
        'Testimony, diary, confession, or interview forms.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'He insists the argument was minor and mentions, twice, that the neighbours never called anyone. The second mention is where the audience turns.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Unreliability revealed only at the end, with no evidence to reread.',
        'Lying to the audience about facts the narration had no reason to distort.',
        'So much unreliability that nothing can be established and nothing is at stake.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['point-of-view', 'frame-story', 'dramatic-irony', 'narrative-voice'],
    },
  ],
};
export default page;
