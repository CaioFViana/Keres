import type { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'character-arc',
  title: 'Character arc',
  summary: 'A measurable change in what a character believes, shown through choices.',
  keywords: [
    'character arc',
    'arco de personagem',
    'change arc',
    'positive arc',
    'negative arc',
    'transformation',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The line between who the character is at the start and who they are at the end, drawn through decisions rather than statements. A positive arc replaces a false belief with a truer one; a negative arc lets the false belief win. The arc is legible only if the same situation appears twice and is handled differently.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'You want the ending to feel like a conclusion instead of a stop.',
        'A long work needs a way to measure progress that is not plot.',
        'You are designing an ensemble and need each thread to justify its length.',
        'You suspect a character is being pushed by events instead of changing.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'Chapter one: asked to cover for a colleague, he agrees to avoid conflict. Chapter thirty: same request, higher stakes, and he says no in the same room, in almost the same words.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Announcing the change in dialogue rather than staging it in a decision.',
        'Changing the circumstances instead of the character and calling it growth.',
        'Forcing an arc onto a character whose function is to stay fixed.',
      ],
    },
    { type: 'seeAlso', pages: ['flat-arc', 'want-vs-need', 'the-wound', 'story-circle'] },
  ],
};
export default page;
