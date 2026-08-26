import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'freytags-pyramid',
  title: 'Freytag pyramid',
  summary: 'A five-part curve: exposition, rising action, climax, falling action, resolution.',
  keywords: ['freytag', 'pyramid', 'climax', 'denouement', 'piramide de freytag', 'tragedy'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A nineteenth-century description of dramatic shape, drawn from classical tragedy. It places the climax near the middle rather than the end, and gives real weight to the falling action: the stretch where consequences play out after the decisive act.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The story is about consequence more than about suspense.',
        'A tragedy, where the audience needs to watch the fall in full.',
        'You want an ending that breathes instead of stopping at the peak.',
        'You are analysing a finished work and want vocabulary for its curve.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'A judge takes a bribe at the midpoint. The rest of the work is not whether she gets caught but the slow arithmetic of what the bribe costs her, ending in a quiet resolution rather than a bang.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Applying it to fast commercial forms that want the climax near the end.',
        'Confusing falling action with epilogue; falling action still contains conflict.',
        'Reading the pyramid as a formula rather than a description of works already written.',
      ],
    },
    { type: 'seeAlso', pages: ['three-act-structure', 'fichtean-curve', 'pacing', 'bookending'] },
  ],
};
export default page;
