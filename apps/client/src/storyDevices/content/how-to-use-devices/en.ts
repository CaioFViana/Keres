import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'how-to-use-devices',
  title: 'How to use this list',
  summary: 'What these entries are, what they are not, and how to take them further.',
  keywords: ['devices', 'craft', 'writing', 'research', 'disclaimer', 'how to use'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A short catalog of narrative devices: named techniques that writers, screenwriters, and game designers pass around. Each entry says what the device is, when it tends to help, one example, and how it usually fails.',
    },
    {
      type: 'callout',
      tone: 'info',
      text: 'Honest disclaimer: this list was compiled by someone who is not a scholar of literary theory. The entries are short summaries of terms already established elsewhere, written to spark your own research — not to settle it. Treat every page as a starting point and go find the source.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'paragraph',
      text: 'Devices are tools, not rules. Great work breaks all of them on purpose. Use the list when you are stuck, when a scene works but you cannot say why, or when you want vocabulary for a problem you already feel.',
    },
    {
      type: 'paragraph',
      text: 'The wording is kept deliberately medium-agnostic — "the work", "the scene", "the audience" — so it applies to a novel, a screenplay, a comic, or a branching game equally.',
    },
    { type: 'heading', level: 2, text: 'How to research further' },
    {
      type: 'steps',
      items: [
        'Note the original name, usually the English one, since most of the literature uses it.',
        'Look for who coined the term and read them, not a summary of them.',
        'Find three works in your own medium that use the device and see how each one bends it.',
        'Try the device once on purpose in a draft. Reading about it teaches far less than using it badly.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Nothing. This list is reference material: it does not read, change, or store anything about your story. You can hide it entirely by turning off "Suggest literary devices" in App Settings.',
    },
    { type: 'seeAlso', pages: ['three-act-structure', 'want-vs-need', 'show-dont-tell'] },
  ],
};
export default page;
