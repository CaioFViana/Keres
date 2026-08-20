import { StoryDevicePage } from '../../types';
const page: StoryDevicePage = {
  id: 'refusal-of-the-call',
  title: 'Refusal of the call',
  summary: 'The protagonist says no first, and the reason tells us who they are.',
  keywords: ['refusal of the call', 'reluctant hero', 'recusa do chamado', 'debate', 'hesitation'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Before accepting the story, the character declines it. The refusal is not delay: it names the fear, duty, or belief the whole work will have to dismantle, and it makes the eventual yes cost something.',
    },
    { type: 'heading', level: 2, text: 'When to use it' },
    {
      type: 'list',
      items: [
        'The premise is so attractive that instant acceptance would feel unreal.',
        'You need to establish the fear the ending will resolve.',
        'The character has genuine obligations that the adventure would betray.',
        'You want the audience to argue with the character and get invested.',
      ],
    },
    {
      type: 'example',
      title: 'Example',
      text: 'A translator refuses to testify because her mother is undocumented. The refusal states the price of the yes long before she says it.',
    },
    { type: 'heading', level: 2, text: 'Pitfalls' },
    {
      type: 'list',
      items: [
        'Refusing for no articulable reason, which reads as stalling.',
        'Having the refusal overridden by external force, so the character never chooses.',
        'Making it so long that the audience accepts the call before the protagonist does.',
      ],
    },
    { type: 'seeAlso', pages: ['heros-journey', 'want-vs-need', 'impossible-choice', 'the-wound'] },
  ],
};
export default page;
