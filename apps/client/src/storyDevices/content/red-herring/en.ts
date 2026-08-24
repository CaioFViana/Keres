import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'red-herring',
  title: 'Red herring',
  summary: 'A deliberate false lead that keeps the real answer hidden in plain sight.',
  keywords: ['red herring', 'pista falsa', 'misdirection', 'mystery', 'suspect', 'decoy'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Information, behaviour, or a character placed so the audience builds a wrong but reasonable theory. A fair red herring has an honest explanation of its own: when the truth lands, the false lead should still make sense, not evaporate.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'Mystery, thriller, or any work where guessing is part of the pleasure.',
        'The real answer is visible too early and needs company.',
        'You want a secondary character to carry real weight before being cleared.',
        'The audience needs to be wrong in a way that teaches them something.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'The neighbour lies about where he was that night. He was at a clinic he is ashamed of. The lie is real, the conclusion is not.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'A herring that only exists to deceive, which feels like cheating once explained.',
        'So many false leads that the truth arrives with no accumulated weight.',
        'Withholding the real clue entirely, which is not misdirection but omission.',
      ],
    },
    {
      type: 'seeAlso',
      pages: ['foreshadowing', 'macguffin', 'dramatic-irony', 'subversion-of-tropes'],
    },
  ],
};
export default page;
