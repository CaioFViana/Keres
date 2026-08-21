import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'heroines-journey',
  title: 'Heroine journey',
  summary: 'A cycle of separation, false success, descent, and reintegration of the self.',
  keywords: [
    'heroines journey',
    'murdock',
    'reintegration',
    'jornada da heroina',
    'descent',
    'wholeness',
  ],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'A counter-model to the conquest-shaped journey. The protagonist rejects part of themselves to succeed by external rules, achieves that success, finds it hollow, descends into what they abandoned, and returns by integrating both halves rather than defeating an enemy.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The real antagonist is an internalised expectation rather than a person.',
        'The protagonist wins early and the story is about what winning cost.',
        'You want a resolution that heals a split instead of destroying an opponent.',
        'A conquest arc keeps making your protagonist feel like a stranger.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'An architect builds her reputation by never mentioning the town she came from, wins the commission she wanted, cannot design anything after it, goes home, and finds the vocabulary she had buried.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Turning the descent into a montage; it is the substance, not the transition.',
        'Framing reintegration as giving up ambition rather than as widening it.',
        'Treating the model as gendered by rule rather than as a shape available to any character.',
      ],
    },
    { type: 'seeAlso', pages: ['heros-journey', 'want-vs-need', 'character-arc', 'the-wound'] },
  ],
};
export default page;
